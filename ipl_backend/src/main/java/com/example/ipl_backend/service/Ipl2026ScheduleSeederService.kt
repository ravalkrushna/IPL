package com.example.ipl_backend.service

import com.example.ipl_backend.model.IplMatch
import com.example.ipl_backend.model.UpcomingMatch
import com.example.ipl_backend.repository.IplMatchRepository
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
    private val upcomingMatchRepository: UpcomingMatchRepository,
    private val iplMatchRepository: IplMatchRepository,
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

    fun seedSchedule(): SeedResult {
        log.info("Scraping IPL 2026 schedule from ESPNcricinfo…")
        val matches = fetchMatches()
        if (matches.isEmpty()) {
            log.warn("No matches returned from scraper — nothing seeded")
            return SeedResult(0, 0, "Scraper returned no matches — try again later")
        }
        return persistMatches(matches)
    }

    fun reseedSchedule(): SeedResult {
        log.info("Reseeding — clearing existing 2026 upcoming fixtures…")
        val deleted = upcomingMatchRepository.deleteBySeason(SEASON)
        iplMatchRepository.deleteUnscrapedBySeason(SEASON)
        log.info("Deleted $deleted existing record(s)")
        val matches = fetchMatches()
        if (matches.isEmpty()) {
            log.warn("No matches returned from scraper — nothing reseeded")
            return SeedResult(0, 0, "Scraper returned no matches — try again later")
        }
        return persistMatches(matches)
    }

    // ── Fetch from live scraper only ──────────────────────────────────────────

    private fun fetchMatches(): List<ParsedMatch> {
        return try {
            val scraped = scrapeFromEspncricinfo()
            if (scraped.isEmpty()) {
                log.warn("Live scrape returned no matches — ESPNcricinfo page may have changed")
                emptyList()
            } else {
                log.info("Live scrape succeeded — ${scraped.size} matches found")
                scraped
            }
        } catch (e: Exception) {
            log.error("Live scrape failed: ${e.message} — call reseed-2026-schedule again later")
            emptyList()
        }
    }

    // ── Persist to both upcoming_matches and ipl_matches ─────────────────────

    private fun persistMatches(matches: List<ParsedMatch>): SeedResult {
        var inserted = 0
        var skipped  = 0

        for (m in matches) {
            val id = "ipl-2026-m${m.matchNo}"

            // ── Save to upcoming_matches (fixtures sheet display) ──────────────
            val upcomingRecord = UpcomingMatch(
                id        = id,
                matchNo   = m.matchNo,
                teamA     = m.teamA,
                teamB     = m.teamB,
                matchDate = m.matchDate,
                season    = SEASON,
                createdAt = Instant.now().toEpochMilli()
            )
            val wasInserted = upcomingMatchRepository.saveIfAbsent(upcomingRecord)

            // ── Also save to ipl_matches (used by cron FK lookup) ─────────────
            val iplRecord = IplMatch(
                id          = id,
                matchNo     = m.matchNo,
                teamA       = m.teamA,
                teamB       = m.teamB,
                matchDate   = m.matchDate,
                cricinfoUrl = m.cricinfoUrl,
                isScraped   = false,
                season      = SEASON,
                createdAt   = Instant.now().toEpochMilli()
            )
            iplMatchRepository.findOrCreate(iplRecord)

            if (wasInserted) {
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
            throw IllegalStateException("No match links found — ESPNcricinfo page structure may have changed")

        log.info("Found ${byMatchNo.size} match links from ESPNcricinfo")

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