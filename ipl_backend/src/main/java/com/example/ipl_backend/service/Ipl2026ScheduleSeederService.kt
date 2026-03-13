package com.example.ipl_backend.service

import com.example.ipl_backend.model.UpcomingMatch
import com.example.ipl_backend.repository.UpcomingMatchRepository
import org.jsoup.Jsoup
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale

@Service
class Ipl2026ScheduleSeederService(
    private val upcomingMatchRepository: UpcomingMatchRepository,  // ← changed from IplMatchRepository
    private val sheetsSyncService: GoogleSheetsSyncService
) {

    private val log = LoggerFactory.getLogger(javaClass)

    companion object {
        const val SCHEDULE_URL =
            "https://www.espncricinfo.com/series/ipl-2026-1510719/match-schedule-fixtures-and-results"
        const val SEASON = "2026"

        val SLUG_TO_CODE = mapOf(
            "royal-challengers-bengaluru" to "RCB",
            "sunrisers-hyderabad"         to "SRH",
            "mumbai-indians"              to "MI",
            "kolkata-knight-riders"       to "KKR",
            "rajasthan-royals"            to "RR",
            "chennai-super-kings"         to "CSK",
            "punjab-kings"                to "PBKS",
            "gujarat-titans"              to "GT",
            "lucknow-super-giants"        to "LSG",
            "delhi-capitals"              to "DC"
        )

        val NAME_TO_CODE = mapOf(
            "Royal Challengers Bengaluru" to "RCB",
            "Sunrisers Hyderabad"         to "SRH",
            "Mumbai Indians"              to "MI",
            "Kolkata Knight Riders"       to "KKR",
            "Rajasthan Royals"            to "RR",
            "Chennai Super Kings"         to "CSK",
            "Punjab Kings"                to "PBKS",
            "Gujarat Titans"              to "GT",
            "Lucknow Super Giants"        to "LSG",
            "Delhi Capitals"              to "DC"
        )

        val DATE_FMT: DateTimeFormatter =
            DateTimeFormatter.ofPattern("EEE, d MMM ''yy", Locale.ENGLISH)

        val MATCH_URL_REGEX = Regex(
            "/series/ipl-2026-\\d+/([a-z-]+)-vs-([a-z-]+)-(\\d+)(?:st|nd|rd|th)-match-(\\d+)/"
        )
    }

    data class ParsedMatch(
        val matchNo: Int,
        val teamA: String,
        val teamB: String,
        val matchDate: Long,
        val cricinfoUrl: String
    )

    data class SeedResult(
        val inserted: Int,
        val skipped: Int,
        val message: String
    )

    // ── Public entry points ───────────────────────────────────────────────────

    /**
     * Idempotent — inserts only matches not already in upcoming_matches.
     * Safe to call multiple times.
     */
    fun seedSchedule(): SeedResult {
        log.info("Scraping IPL 2026 schedule from ESPNcricinfo…")
        val matches = fetchMatches()
        return persistMatches(matches)
    }

    /**
     * Wipes all 2026 upcoming fixtures and re-inserts from latest scrape.
     * Use when new phases are published or fixtures change.
     */
    fun reseedSchedule(): SeedResult {
        log.info("Reseeding — clearing existing 2026 upcoming fixtures…")
        val deleted = upcomingMatchRepository.deleteBySeason(SEASON)
        log.info("Deleted $deleted existing record(s)")
        val matches = fetchMatches()
        return persistMatches(matches)
    }

    // ── Fetch (scrape → fallback) ─────────────────────────────────────────────

    private fun fetchMatches(): List<ParsedMatch> = try {
        val scraped = scrapeFromEspncricinfo()
        if (scraped.isEmpty()) throw IllegalStateException("Scraper returned no matches")
        log.info("Live scrape succeeded — ${scraped.size} matches")
        scraped
    } catch (e: Exception) {
        log.warn("Live scrape failed (${e.message}) — falling back to verified schedule")
        verifiedSchedule()
    }

    // ── Persist to upcoming_matches ───────────────────────────────────────────

    private fun persistMatches(matches: List<ParsedMatch>): SeedResult {
        var inserted = 0
        var skipped  = 0

        for (m in matches) {
            val record = UpcomingMatch(
                id        = "ipl-2026-m${m.matchNo}",   // stable deterministic ID
                matchNo   = m.matchNo,
                teamA     = m.teamA,
                teamB     = m.teamB,
                matchDate = m.matchDate,
                season    = SEASON,
                createdAt = Instant.now().toEpochMilli()
            )

            if (upcomingMatchRepository.saveIfAbsent(record)) {
                log.info("  ✅ Inserted Match ${m.matchNo}: ${m.teamA} vs ${m.teamB}")
                inserted++
            } else {
                log.debug("  ⏭️  Match ${m.matchNo} already exists — skipped")
                skipped++
            }
        }

        try {
            sheetsSyncService.syncFixturesToSheet()
            log.info("Fixtures sheet updated after seeding")
        } catch (e: Exception) {
            log.error("Sheet sync after seed failed: ${e.message}", e)
        }

        val msg = "IPL 2026 — $inserted inserted, $skipped skipped"
        log.info(msg)
        return SeedResult(inserted, skipped, msg)
    }

    // ── Live web scraper (ESPNcricinfo) ───────────────────────────────────────

    private fun scrapeFromEspncricinfo(): List<ParsedMatch> {
        val doc = Jsoup.connect(SCHEDULE_URL)
            .userAgent(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
                        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            )
            .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
            .header("Accept-Language", "en-US,en;q=0.9")
            .timeout(15_000)
            .get()

        // Step 1: extract match links → matchNo, team codes, cricinfoUrl
        data class LinkEntry(
            val matchNo: Int,
            val teamA: String,
            val teamB: String,
            val cricinfoId: String,
            val href: String
        )

        val byMatchNo = mutableMapOf<Int, LinkEntry>()

        doc.select("a[href]").forEach { el ->
            val href    = el.attr("href")
            val mr      = MATCH_URL_REGEX.find(href) ?: return@forEach
            val matchNo = mr.groupValues[3].toIntOrNull() ?: return@forEach
            if (matchNo in byMatchNo) return@forEach

            val absoluteHref = if (href.startsWith("http")) href
            else "https://www.espncricinfo.com$href"

            byMatchNo[matchNo] = LinkEntry(
                matchNo    = matchNo,
                teamA      = SLUG_TO_CODE[mr.groupValues[1]] ?: mr.groupValues[1].uppercase().take(4),
                teamB      = SLUG_TO_CODE[mr.groupValues[2]] ?: mr.groupValues[2].uppercase().take(4),
                cricinfoId = mr.groupValues[4],
                href       = absoluteHref
            )
        }

        if (byMatchNo.isEmpty())
            throw IllegalStateException("No match links found — page structure may have changed")

        log.info("Found ${byMatchNo.size} match links from ESPNcricinfo")

        // Step 2: walk elements to extract date → team pairings
        var currentDate: LocalDate? = null
        var pendingTeamA: String?   = null
        val dateByTeams = mutableMapOf<Pair<String, String>, Long>()

        for (el in doc.body().allElements) {
            val text = el.ownText().trim()
            if (text.isBlank()) continue

            if (text.length <= 20 && text.contains("'")) {
                runCatching { LocalDate.parse(text, DATE_FMT) }.getOrNull()?.let { d ->
                    currentDate  = d
                    pendingTeamA = null
                }
                continue
            }

            val code = NAME_TO_CODE[text] ?: continue
            val date = currentDate ?: continue

            if (pendingTeamA == null) {
                pendingTeamA = code
            } else {
                val epochMs = LocalDateTime.of(date, LocalTime.of(14, 0))
                    .toInstant(ZoneOffset.UTC).toEpochMilli()
                dateByTeams[Pair(pendingTeamA!!, code)] = epochMs
                pendingTeamA = null
            }
        }

        log.info("Extracted ${dateByTeams.size} date entries from page body")

        // Step 3: join links + dates
        return byMatchNo.values.mapNotNull { link ->
            val date = dateByTeams[Pair(link.teamA, link.teamB)]
                ?: dateByTeams[Pair(link.teamB, link.teamA)]
                ?: run {
                    log.warn("Date not found for Match ${link.matchNo} — using estimate")
                    fallbackDate(link.matchNo)
                }

            ParsedMatch(
                matchNo     = link.matchNo,
                teamA       = link.teamA,
                teamB       = link.teamB,
                matchDate   = date,
                cricinfoUrl = link.href
            )
        }.sortedBy { it.matchNo }
    }

    // ── Verified fallback schedule ────────────────────────────────────────────
    // Used when live scraping fails.
    // Times: 14:00 UTC = 7:30 PM IST (evening), 10:00 UTC = 3:30 PM IST (afternoon DH)

    private fun verifiedSchedule(): List<ParsedMatch> {
        data class E(val n: Int, val a: String, val b: String, val date: String, val utcH: Int, val ciId: Int)

        val rev = SLUG_TO_CODE.entries.associate { (slug, code) -> code to slug }

        return listOf(
            E(1,  "RCB",  "SRH",  "2026-03-28", 14, 1527674),
            E(2,  "MI",   "KKR",  "2026-03-29", 14, 1527675),
            E(3,  "RR",   "CSK",  "2026-03-30", 14, 1527676),
            E(4,  "PBKS", "GT",   "2026-03-31", 14, 1527677),
            E(5,  "LSG",  "DC",   "2026-04-01", 14, 1527678),
            E(6,  "KKR",  "SRH",  "2026-04-02", 14, 1527679),
            E(7,  "CSK",  "PBKS", "2026-04-03", 14, 1527680),
            E(8,  "DC",   "MI",   "2026-04-04", 10, 1527681),
            E(9,  "GT",   "RR",   "2026-04-04", 14, 1527682),
            E(10, "SRH",  "LSG",  "2026-04-05", 10, 1527683),
            E(11, "RCB",  "CSK",  "2026-04-05", 14, 1527684),
            E(12, "KKR",  "PBKS", "2026-04-06", 14, 1527685),
            E(13, "RR",   "MI",   "2026-04-07", 14, 1527686),
            E(14, "DC",   "GT",   "2026-04-08", 14, 1527687),
            E(15, "KKR",  "LSG",  "2026-04-09", 14, 1527688),
            E(16, "RR",   "RCB",  "2026-04-10", 14, 1527689),
            E(17, "PBKS", "SRH",  "2026-04-11", 10, 1527690),
            E(18, "CSK",  "DC",   "2026-04-11", 14, 1527691),
            E(19, "LSG",  "GT",   "2026-04-12", 10, 1527692),
            E(20, "MI",   "RCB",  "2026-04-12", 14, 1527693)
        ).map { e ->
            val epochMs = LocalDateTime
                .of(LocalDate.parse(e.date), LocalTime.of(e.utcH, 0))
                .toInstant(ZoneOffset.UTC).toEpochMilli()
            val slugA = rev[e.a] ?: e.a.lowercase()
            val slugB = rev[e.b] ?: e.b.lowercase()
            ParsedMatch(
                matchNo     = e.n,
                teamA       = e.a,
                teamB       = e.b,
                matchDate   = epochMs,
                cricinfoUrl = "https://www.espncricinfo.com/series/ipl-2026-1510719/" +
                        "$slugA-vs-$slugB-${e.n}${ordinalSuffix(e.n)}-match-${e.ciId}/live-cricket-score"
            )
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun fallbackDate(matchNo: Int): Long {
        val base = LocalDate.parse("2026-03-28").plusDays((matchNo - 1).toLong())
        return LocalDateTime.of(base, LocalTime.of(14, 0)).toInstant(ZoneOffset.UTC).toEpochMilli()
    }

    private fun ordinalSuffix(n: Int): String = when {
        n in 11..13 -> "th"
        n % 10 == 1 -> "st"
        n % 10 == 2 -> "nd"
        n % 10 == 3 -> "rd"
        else        -> "th"
    }
}