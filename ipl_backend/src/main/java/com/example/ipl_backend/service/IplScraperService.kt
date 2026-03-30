package com.example.ipl_backend.service

import com.example.ipl_backend.model.UpcomingMatch
import com.example.ipl_backend.repository.UpcomingMatchRepository
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpEntity
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpMethod
import org.springframework.stereotype.Service
import org.springframework.web.client.HttpStatusCodeException
import org.springframework.web.client.RestTemplate
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZoneOffset

// ── Scraped models (unchanged — consumed by FantasyCronService) ──────────────

data class ScrapedPlayerStats(
    val playerName: String,
    val runs: Int = 0,
    val ballsFaced: Int = 0,
    val fours: Int = 0,
    val sixes: Int = 0,
    val dismissed: Boolean = false,
    val oversBowled: Double = 0.0,
    val runsGiven: Int = 0,
    val wickets: Int = 0,
    val maidens: Int = 0,
    val lbwBowledCount: Int = 0,
    val catches: Int = 0,
    val stumpings: Int = 0,
    val runOutsDirect: Int = 0,
    val runOutsIndirect: Int = 0,
    val playingXi: Boolean = true
)

data class ScrapedMatch(
    val matchLabel: String,
    val matchNumber: Int,
    val team1: String,
    val team2: String,
    val date: String,
    val players: List<ScrapedPlayerStats>
)

/** One fixture row from official IPL `matchschedule.js` — used by [Ipl2026ScheduleSeederService]. */
data class IplFeedFixtureRow(
    val matchNo: Int,
    val teamA: String,
    val teamB: String,
    val matchDateEpochMs: Long
)

/**
 * Fantasy match data from official IPL JSON feeds (same source as iplt20.com / Match Centre).
 *
 * Flow: [currentcompetition.js] → competition id + feed base → [284-matchschedule.js] for fixtures/results,
 * then per match: `{matchId}-Innings1.js` … `Innings4.js` (JSONP `onScoring(...)`) for full scorecards.
 */
@Service
class IplScraperService(
    private val upcomingMatchRepository: UpcomingMatchRepository
) {

    private val log = LoggerFactory.getLogger(javaClass)
    private val jsonMapper = jacksonObjectMapper()

    /**
     * When [scores.iplt20.com] returns 403 (Akamai), we use this competition id + [fallbackFeedBase].
     * Update next season if BCCI changes the id (check match centre network tab or `currentcompetition.js` in a browser).
     */
    @Value("\${ipl.feed.competition-id:284}")
    private var fallbackCompetitionId: Int = 284

    /** Public S3 JSONP base (no trailing slash) — same feeds the IPL site loads after discovery. */
    @Value("\${ipl.feed.base-url:https://ipl-stats-sports-mechanic.s3.ap-south-1.amazonaws.com/ipl/feeds}")
    private lateinit var fallbackFeedBase: String

    private val restTemplate = RestTemplate()

    /** Last [resolveCompetition] used S3/env fallback (scores site blocked). For diagnostics only. */
    @Volatile
    private var lastResolvedViaScoresFallback: Boolean = false

    companion object {
        const val SEASON = "2026"
        private const val COMPETITION_JS =
            "https://scores.iplt20.com/ipl/mc/currentcompetition.js"

        /** Browser-like UA — reduces 403 from edgesuite on scores.iplt20.com (best-effort). */
        private const val BROWSER_USER_AGENT =
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    }

    private data class IplCompetition(
        val competitionId: Int,
        val feedBase: String,
        val codingType: String
    )

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Fetch scorecard for an official IPL **numeric** match id (see [iplFeedDiagnostics] / schedule).
     */
    fun scrapeMatchByIplMatchId(iplMatchId: String): ScrapedMatch? {
        val id = iplMatchId.trim().toIntOrNull() ?: return null
        return try {
            val comp = resolveCompetition()
            val schedule = loadMatchSchedule(comp)
            val row = schedule.firstOrNull { it.path("MatchID").asInt(0) == id }
            val title = row?.path("MatchName")?.asText()?.takeIf { it.isNotBlank() }
                ?: "Match $id"
            val dateStr = row?.path("MatchDate")?.asText() ?: LocalDate.now(ZoneId.of("Asia/Kolkata")).toString()
            scrapeFromInningsFeeds(comp, id, title, dateStr, row)
        } catch (e: Exception) {
            log.error("scrapeMatchByIplMatchId: ${e.message}", e)
            null
        }
    }

    /** Legacy name — same as [scrapeMatchByIplMatchId] (numeric IPL match id). */
    fun scrapeMatchByCricApiId(cricApiMatchId: String): ScrapedMatch? = scrapeMatchByIplMatchId(cricApiMatchId)

    /**
     * Full season fixture list from official JSON (S3 / iplt20.com). Replaces ESPN scraping (often 403 from Akamai).
     */
    fun loadFixtureRowsFromOfficialFeed(): List<IplFeedFixtureRow> {
        val comp = resolveCompetition()
        val schedule = scheduleAsList(loadMatchSchedule(comp))
        val out = ArrayList<IplFeedFixtureRow>(schedule.size)
        for (m in schedule) {
            val matchNo = m.path("MatchOrder").asText().trim().toIntOrNull()
                ?: m.path("RowNo").asInt(0)
            if (matchNo <= 0) continue
            val teamA = teamShortCodeFromScheduleRow(m, isHome = true)
            val teamB = teamShortCodeFromScheduleRow(m, isHome = false)
            if (teamA.isBlank() || teamB.isBlank()) {
                log.warn("Skipping schedule row — missing team codes (matchNo=$matchNo)")
                continue
            }
            out.add(
                IplFeedFixtureRow(
                    matchNo = matchNo,
                    teamA = teamA,
                    teamB = teamB,
                    matchDateEpochMs = parseFixtureEpochMs(m)
                )
            )
        }
        log.info("loadFixtureRowsFromOfficialFeed: {} rows from feed", out.size)
        return out.sortedBy { it.matchNo }
    }

    fun listRecentIplMatchesForDebug(limit: Int = 50): List<Map<String, Any?>> {
        return try {
            val comp = resolveCompetition()
            val schedule = scheduleAsList(loadMatchSchedule(comp))
            schedule.asSequence()
                .filter { it.path("MatchStatus").asText("") == "Post" }
                .sortedByDescending { it.path("MatchDate").asText("") }
                .take(limit)
                .map { m ->
                    mapOf<String, Any?>(
                        "id" to m.path("MatchID").asInt().toString(),
                        "name" to m.path("MatchName").asText(),
                        "status" to m.path("MatchStatus").asText(),
                        "date" to m.path("MatchDate").asText(),
                        "result" to m.path("Commentss").asText()
                    )
                }
                .toList()
        } catch (e: Exception) {
            log.error("listRecentIplMatchesForDebug: ${e.message}", e)
            emptyList()
        }
    }

    /** Diagnostics for GET /admin/fantasy/ipl-matches */
    fun iplFeedDiagnostics(): Map<String, Any?> {
        val out = LinkedHashMap<String, Any?>()
        out["source"] = "IPLT20 official feeds (Sports Mechanic JSONP on S3 / scores.iplt20.com)"
        out["resultsPage"] = "https://www.iplt20.com/matches/results"
        return try {
            val comp = resolveCompetition()
            out["competitionSource"] =
                if (lastResolvedViaScoresFallback) {
                    "fallback — ipl.feed.competition-id + ipl.feed.base-url (S3); scores.iplt20.com often returns 403 from servers"
                } else {
                    "discovery — https://scores.iplt20.com/ipl/mc/currentcompetition.js"
                }
            out["competitionId"] = comp.competitionId
            out["feedBase"] = comp.feedBase
            out["codingType"] = comp.codingType
            val scheduleUrl = matchScheduleUrl(comp)
            out["matchScheduleUrl"] = scheduleUrl
            val schedule = scheduleAsList(loadMatchSchedule(comp))
            out["scheduleRows"] = schedule.size
            val completed = schedule.count { it.path("MatchStatus").asText("") == "Post" }
            out["completedMatchCount"] = completed
            out["sampleCompleted"] = schedule.asSequence()
                .filter { it.path("MatchStatus").asText("") == "Post" }
                .take(8)
                .map {
                    mapOf(
                        "matchId" to it.path("MatchID").asInt().toString(),
                        "name" to it.path("MatchName").asText(),
                        "date" to it.path("MatchDate").asText()
                    )
                }
                .toList()
            out["hint"] =
                "POST /admin/fantasy/sync-now?matchId=<id> — saves fantasy points to DB, then Google Sheets (same as cron)."
            out
        } catch (e: Exception) {
            out["error"] = e.message ?: e.javaClass.simpleName
            out
        }
    }

    /** Legacy name — same as [iplFeedDiagnostics]. */
    fun cricapiDiagnostics(): Map<String, Any?> = iplFeedDiagnostics()

    fun scrapeLatestMatch(): ScrapedMatch? {
        return try {
            val comp = resolveCompetition()
            val completed = scheduleAsList(loadMatchSchedule(comp))
                .filter { it.path("MatchStatus").asText("") == "Post" }
            if (completed.isEmpty()) {
                log.warn("No completed matches in IPL schedule feed")
                return null
            }
            val ist = ZoneId.of("Asia/Kolkata")
            val yesterday = LocalDate.now(ist).minusDays(1).toString()
            var row = findCompletedOnDate(completed, yesterday)
            if (row == null) {
                val twoAgo = LocalDate.now(ist).minusDays(2).toString()
                log.warn("No completed match on $yesterday, trying $twoAgo")
                row = findCompletedOnDate(completed, twoAgo)
            }
            if (row == null) {
                row = findMostRecentCompleted(completed, days = 14, ist)
            }
            if (row == null) {
                log.warn("No suitable completed IPL match in last 14 days (IST)")
                return null
            }
            val mid = row.path("MatchID").asInt()
            val title = row.path("MatchName").asText()
            val dateStr = row.path("MatchDate").asText()
            log.info("IPL feed pick: $title (MatchID=$mid)")
            scrapeFromInningsFeeds(comp, mid, title, dateStr, row)
        } catch (e: Exception) {
            log.error("scrapeLatestMatch: ${e.message}", e)
            null
        }
    }

    fun syncUpcomingMatches(): Int {
        return try {
            val comp = resolveCompetition()
            val upcoming = scheduleAsList(loadMatchSchedule(comp))
                .filter { it.path("MatchStatus").asText("") == "UpComing" }
            var saved = 0
            upcoming.forEach { m ->
                try {
                    val matchId = m.path("MatchID").asInt().toString()
                    val title = m.path("MatchName").asText()
                    val (team1, team2) = parseTeams(title)
                    val matchNo = extractMatchNumberFromSchedule(m, title)
                    val dateStr = m.path("MatchDate").asText()
                    val epochMs = parseMatchDateStartUtc(dateStr)
                    val record = UpcomingMatch(
                        id = matchId,
                        matchNo = matchNo,
                        teamA = team1,
                        teamB = team2,
                        matchDate = epochMs,
                        season = SEASON,
                        createdAt = Instant.now().toEpochMilli()
                    )
                    if (upcomingMatchRepository.saveIfAbsent(record)) {
                        log.info("  Saved upcoming: Match $matchNo — $team1 vs $team2 on $dateStr")
                        saved++
                    }
                } catch (e: Exception) {
                    log.warn("  Skipped row: ${e.message}")
                }
            }
            log.info("syncUpcomingMatches complete — $saved new rows")
            saved
        } catch (e: Exception) {
            log.error("syncUpcomingMatches failed: ${e.message}", e)
            0
        }
    }

    // ── Feed loading ──────────────────────────────────────────────────────────

    private fun resolveCompetition(): IplCompetition {
        lastResolvedViaScoresFallback = false
        runCatching { discoverCompetitionFromScoresSite() }
            .onSuccess { return it }
            .onFailure {
                log.warn(
                    "IPL competition discovery via scores.iplt20.com failed ({}); using ipl.feed.* fallback",
                    it.message
                )
            }
        val base = fallbackFeedBase.trimEnd('/')
        if (fallbackCompetitionId <= 0 || base.isBlank()) {
            throw IllegalStateException(
                "Set ipl.feed.competition-id and ipl.feed.base-url (see application.properties defaults)."
            )
        }
        lastResolvedViaScoresFallback = true
        log.info("Using fallback IPL feed: competitionId={} feedBase={}", fallbackCompetitionId, base)
        return IplCompetition(fallbackCompetitionId, base, codingType = "T20Lite")
    }

    /** Parsed from `currentcompetition.js` when CDN allows (often blocked with 403 from datacenters). */
    private fun discoverCompetitionFromScoresSite(): IplCompetition {
        val body = httpGet(COMPETITION_JS)
        val root = jsonMapper.readTree(extractJsonObject(body))
        val comps = root.path("competition")
        for (i in 0 until comps.size()) {
            val c = comps[i]
            if (c.path("DivisionName").asText() == "IPL" && c.path("SeasonName").asText() == SEASON) {
                val id = c.path("CompetitionID").asInt()
                val feed = c.path("feedsource").asText().trimEnd('/')
                val coding = c.path("CodingType").asText().ifBlank { "T20Lite" }
                log.info("Discovered IPL competition from scores site: id={} feedBase={}", id, feed)
                return IplCompetition(id, feed, coding)
            }
        }
        throw IllegalStateException("No IPL competition for season $SEASON in discovery response")
    }

    private fun matchScheduleUrl(comp: IplCompetition): String {
        val file = if (comp.codingType == "T20Pro") "${comp.competitionId}-matchSchedule.js"
        else "${comp.competitionId}-matchschedule.js"
        return "${comp.feedBase}/$file"
    }

    private fun loadMatchSchedule(comp: IplCompetition): JsonNode {
        val body = httpGet(matchScheduleUrl(comp))
        val root = jsonMapper.readTree(extractJsonObject(body))
        return root.path("Matchsummary")
    }

    private fun scheduleAsList(node: JsonNode): List<JsonNode> {
        if (!node.isArray) return emptyList()
        return (0 until node.size()).map { node[it]!! }
    }

    private fun scrapeFromInningsFeeds(
        comp: IplCompetition,
        matchId: Int,
        matchTitle: String,
        dateStr: String,
        scheduleRow: JsonNode?
    ): ScrapedMatch? {
        val stats = LinkedHashMap<String, ScrapedPlayerStats>()
        var inningsLoaded = 0
        for (label in listOf("Innings1", "Innings2", "Innings3", "Innings4")) {
            val url = "${comp.feedBase}/$matchId-$label.js"
            val body = try {
                httpGet(url)
            } catch (_: Exception) {
                continue
            }
            if (body.isBlank()) continue
            val root = try {
                jsonMapper.readTree(extractJsonObject(body))
            } catch (e: Exception) {
                log.debug("Skip $label for match $matchId: ${e.message}")
                continue
            }
            val inn = root.path(label)
            if (inn.isMissingNode || inn.isNull) continue
            mergeBatting(inn.path("BattingCard"), stats)
            mergeBowling(inn.path("BowlingCard"), stats)
            inn.path("BattingCard").forEach { row ->
                val out = row.path("OutDesc").asText("")
                mergeFieldingFromOutDesc(out, stats)
            }
            inningsLoaded++
        }
        if (stats.isEmpty() || inningsLoaded == 0) {
            log.warn("No player stats for matchId=$matchId (innings loaded=$inningsLoaded)")
            return null
        }
        val (team1, team2) = parseTeams(matchTitle)
        val matchNo = extractMatchNumberFromSchedule(scheduleRow, matchTitle)
        val label = "Match $matchNo (${team1.lowercase()} vs ${team2.lowercase()})"
        log.info("Built $label — ${stats.size} players from IPL feeds")
        return ScrapedMatch(
            matchLabel = label,
            matchNumber = matchNo,
            team1 = team1,
            team2 = team2,
            date = dateStr,
            players = stats.values.toList()
        )
    }

    private fun mergeBatting(card: JsonNode, stats: MutableMap<String, ScrapedPlayerStats>) {
        if (!card.isArray) return
        for (row in card) {
            val rawName = row.path("PlayerName").asText("")
            val name = canonicalPlayerName(rawName)
            if (name.isBlank()) continue
            val outDesc = row.path("OutDesc").asText("")
            val dismissed = isDismissed(outDesc)
            val runs = row.path("Runs").asInt(0)
            val balls = row.path("Balls").asInt(0)
            val fours = row.path("Fours").asInt(0)
            val sixes = row.path("Sixes").asInt(0)
            val existing = stats[name] ?: ScrapedPlayerStats(name)
            stats[name] = existing.copy(
                runs = existing.runs + runs,
                ballsFaced = existing.ballsFaced + balls,
                fours = existing.fours + fours,
                sixes = existing.sixes + sixes,
                dismissed = existing.dismissed || dismissed
            )
        }
    }

    private fun mergeBowling(card: JsonNode, stats: MutableMap<String, ScrapedPlayerStats>) {
        if (!card.isArray) return
        for (row in card) {
            val rawName = row.path("PlayerName").asText("")
            val name = canonicalPlayerName(rawName)
            if (name.isBlank()) continue
            val overs = oversFromNode(row.path("Overs"))
            val maidens = row.path("Maidens").asInt(0)
            val runs = row.path("Runs").asInt(0)
            val wkts = row.path("Wickets").asInt(0)
            val existing = stats[name] ?: ScrapedPlayerStats(name)
            stats[name] = existing.copy(
                oversBowled = existing.oversBowled + overs,
                runsGiven = existing.runsGiven + runs,
                wickets = existing.wickets + wkts,
                maidens = existing.maidens + maidens
            )
        }
    }

    private fun oversFromNode(n: JsonNode): Double =
        when {
            n.isNumber -> n.asDouble()
            n.isTextual -> n.asText().toDoubleOrNull() ?: 0.0
            else -> 0.0
        }

    private fun isDismissed(outDesc: String): Boolean {
        val d = outDesc.trim()
        if (d.isEmpty()) return false
        if (d.contains("not out", ignoreCase = true)) return false
        if (d.contains("did not bat", ignoreCase = true)) return false
        return true
    }

    private fun mergeFieldingFromOutDesc(outDesc: String, stats: MutableMap<String, ScrapedPlayerStats>) {
        val raw = outDesc.trim()
        if (raw.isEmpty()) return
        val low = raw.lowercase()
        if (low.contains("not out") || low.contains("did not bat") || low.contains("absent")) return

        Regex("run out\\s*\\(([^)]+)\\)", RegexOption.IGNORE_CASE).find(raw)?.let { m ->
            val inner = m.groupValues[1]
            if (inner.contains("/")) {
                inner.split("/").forEach { p ->
                    val n = canonicalPlayerName(p.trim())
                    if (n.isNotBlank()) bumpRunOutIndirect(n, stats)
                }
            } else {
                bumpRunOutDirect(canonicalPlayerName(inner.trim()), stats)
            }
            return
        }

        Regex("c\\s*&\\s*b\\s+(.+)", RegexOption.IGNORE_CASE).find(raw)?.let { m ->
            val bowler = canonicalPlayerName(m.groupValues[1])
            if (bowler.isNotBlank()) bumpCatch(bowler, stats)
            return
        }

        Regex("st\\s+(.+?)\\s+b\\s+(.+)", RegexOption.IGNORE_CASE).find(raw)?.let { m ->
            val keeper = canonicalPlayerName(m.groupValues[1])
            if (keeper.isNotBlank()) bumpStumping(keeper, stats)
            return
        }

        Regex("c\\s+(.+?)\\s+b\\s+(.+)", RegexOption.IGNORE_CASE).find(raw)?.let { m ->
            val fielder = canonicalPlayerName(m.groupValues[1])
            if (fielder.isNotBlank()) bumpCatch(fielder, stats)
            return
        }

        Regex("lbw\\s+b\\s+(.+)", RegexOption.IGNORE_CASE).find(raw)?.let { m ->
            val bowler = canonicalPlayerName(m.groupValues[1])
            if (bowler.isNotBlank()) bumpLbwBowled(bowler, stats)
            return
        }

        Regex("hit wicket\\s+b\\s+(.+)", RegexOption.IGNORE_CASE).find(raw)?.let { m ->
            val bowler = canonicalPlayerName(m.groupValues[1])
            if (bowler.isNotBlank()) bumpLbwBowled(bowler, stats)
            return
        }

        Regex("^b\\s+(.+)$", RegexOption.IGNORE_CASE).find(raw.trim())?.let { m ->
            val bowler = canonicalPlayerName(m.groupValues[1])
            if (bowler.isNotBlank()) bumpLbwBowled(bowler, stats)
        }
    }

    private fun bumpCatch(name: String, stats: MutableMap<String, ScrapedPlayerStats>) {
        val e = stats[name] ?: ScrapedPlayerStats(name)
        stats[name] = e.copy(catches = e.catches + 1)
    }

    private fun bumpStumping(name: String, stats: MutableMap<String, ScrapedPlayerStats>) {
        val e = stats[name] ?: ScrapedPlayerStats(name)
        stats[name] = e.copy(stumpings = e.stumpings + 1)
    }

    private fun bumpLbwBowled(name: String, stats: MutableMap<String, ScrapedPlayerStats>) {
        val e = stats[name] ?: ScrapedPlayerStats(name)
        stats[name] = e.copy(lbwBowledCount = e.lbwBowledCount + 1)
    }

    private fun bumpRunOutDirect(name: String, stats: MutableMap<String, ScrapedPlayerStats>) {
        val e = stats[name] ?: ScrapedPlayerStats(name)
        stats[name] = e.copy(runOutsDirect = e.runOutsDirect + 1)
    }

    private fun bumpRunOutIndirect(name: String, stats: MutableMap<String, ScrapedPlayerStats>) {
        val e = stats[name] ?: ScrapedPlayerStats(name)
        stats[name] = e.copy(runOutsIndirect = e.runOutsIndirect + 1)
    }

    private fun canonicalPlayerName(raw: String): String =
        raw.trim()
            .replace(Regex("\\s*\\([^)]*\\)"), "")
            .replace(Regex("\\s+"), " ")
            .trim()

    // ── Schedule pickers ──────────────────────────────────────────────────────

    private fun findCompletedOnDate(rows: List<JsonNode>, isoDate: String): JsonNode? =
        rows.firstOrNull {
            it.path("MatchDate").asText("") == isoDate
        }

    private fun findMostRecentCompleted(rows: List<JsonNode>, days: Long, ist: ZoneId): JsonNode? {
        val today = LocalDate.now(ist)
        val cutoff = today.minusDays(days)
        data class D(val d: LocalDate, val row: JsonNode)
        val candidates = rows.mapNotNull { r ->
            val ds = r.path("MatchDate").asText("")
            val ld = runCatching { LocalDate.parse(ds) }.getOrNull() ?: return@mapNotNull null
            if (ld.isBefore(cutoff) || ld.isAfter(today)) return@mapNotNull null
            D(ld, r)
        }
        if (candidates.isEmpty()) return null
        return candidates.maxWith(compareBy<D> { it.d }.thenBy { it.row.path("MatchID").asInt() }).row
    }

    // ── HTTP / JSONP ────────────────────────────────────────────────────────────

    private fun httpGet(url: String): String {
        val headers = HttpHeaders()
        headers.set(HttpHeaders.USER_AGENT, BROWSER_USER_AGENT)
        headers.set(HttpHeaders.ACCEPT, "*/*")
        headers.set(HttpHeaders.ACCEPT_LANGUAGE, "en-US,en;q=0.9")
        headers.set(HttpHeaders.CONNECTION, "keep-alive")
        headers.set("Referer", "https://www.iplt20.com/")
        headers.set("Origin", "https://www.iplt20.com")
        val entity = HttpEntity<Void>(headers)
        return try {
            val response = restTemplate.exchange(url, HttpMethod.GET, entity, String::class.java)
            response.body ?: throw IllegalStateException("Empty body: $url")
        } catch (e: HttpStatusCodeException) {
            throw IllegalStateException(
                "${e.statusCode} on GET \"$url\": ${e.responseBodyAsString.take(500)}",
                e
            )
        }
    }

    /** First top-level `{ ... }` in a JSONP wrapper. */
    private fun extractJsonObject(js: String): String {
        val start = js.indexOf('{')
        if (start < 0) throw IllegalArgumentException("No JSON object in response")
        var depth = 0
        for (i in start until js.length) {
            when (js[i]) {
                '{' -> depth++
                '}' -> {
                    depth--
                    if (depth == 0) return js.substring(start, i + 1)
                }
            }
        }
        throw IllegalArgumentException("Unbalanced JSON in feed response")
    }

    private fun parseMatchDateStartUtc(dateStr: String): Long =
        try {
            LocalDate.parse(dateStr.take(10))
                .atStartOfDay(ZoneOffset.UTC)
                .toInstant()
                .toEpochMilli()
        } catch (_: Exception) {
            Instant.now().toEpochMilli()
        }

    private fun parseTeams(matchName: String): Pair<String, String> {
        val vsRegex = Regex("(.+?)\\s+vs\\.?\\s+(.+?)(?:,|$)", RegexOption.IGNORE_CASE)
        val m = vsRegex.find(matchName)
        val team1 = m?.groupValues?.get(1)?.trim()?.let { fullNameToShort(it) } ?: "TBD"
        val team2 = m?.groupValues?.get(2)?.trim()?.let { fullNameToShort(it) } ?: "TBD"
        return Pair(team1, team2)
    }

    private fun extractMatchNumberFromSchedule(row: JsonNode?, matchName: String): Int {
        val order = row?.path("MatchOrder")?.asText()?.trim()?.toIntOrNull()
        if (order != null && order > 0) return order
        val rowNo = row?.path("RowNo")?.asInt(0) ?: 0
        if (rowNo > 0) return rowNo
        return Regex("match\\s*(\\d+)", RegexOption.IGNORE_CASE)
            .find(matchName)?.groupValues?.get(1)?.toIntOrNull() ?: 1
    }

    private fun fullNameToShort(name: String): String =
        IPL_SHORT_NAMES[name.trim()] ?: name.trim()
            .split(" ").map { it.take(3) }
            .joinToString("")
            .uppercase()
            .take(4)

    private val IPL_SHORT_NAMES = mapOf(
        "Mumbai Indians" to "MI",
        "Chennai Super Kings" to "CSK",
        "Royal Challengers Bengaluru" to "RCB",
        "Royal Challengers Bangalore" to "RCB",
        "Kolkata Knight Riders" to "KKR",
        "Delhi Capitals" to "DC",
        "Punjab Kings" to "PBKS",
        "Rajasthan Royals" to "RR",
        "Sunrisers Hyderabad" to "SRH",
        "Gujarat Titans" to "GT",
        "Lucknow Super Giants" to "LSG"
    )

    private fun teamShortCodeFromScheduleRow(m: JsonNode, isHome: Boolean): String {
        val codeField = if (isHome) "HomeTeamCode" else "AwayTeamCode"
        val explicit = m.path(codeField).asText().trim()
        if (explicit.isNotEmpty()) return explicit
        val full = if (isHome) m.path("HomeTeamName").asText().trim() else m.path("AwayTeamName").asText().trim()
        if (full.isEmpty()) return ""
        return IPL_SHORT_NAMES[full] ?: full.split(" ").filter { it.isNotEmpty() }
            .joinToString("") { it.first().toString() }
            .uppercase()
            .take(4)
    }

    private fun parseFixtureEpochMs(m: JsonNode): Long {
        val commence = m.path("MATCH_COMMENCE_START_DATE").asText().trim()
        if (commence.isNotBlank()) {
            val ms = runCatching {
                val normalized = commence.replace(" ", "T").take(19)
                LocalDateTime.parse(normalized)
                    .atZone(ZoneId.of("Asia/Kolkata"))
                    .toInstant()
                    .toEpochMilli()
            }.getOrNull()
            if (ms != null) return ms
            log.warn("Could not parse MATCH_COMMENCE_START_DATE: {}", commence)
        }
        val d = m.path("MatchDate").asText().take(10)
        val t = m.path("MatchTime").asText().trim()
        return runCatching {
            val time = Regex("^(\\d{1,2}):(\\d{2})$").find(t)?.let {
                LocalTime.of(it.groupValues[1].toInt(), it.groupValues[2].toInt())
            } ?: LocalTime.of(19, 30)
            LocalDate.parse(d)
                .atTime(time)
                .atZone(ZoneId.of("Asia/Kolkata"))
                .toInstant()
                .toEpochMilli()
        }.getOrElse {
            LocalDate.parse("2026-03-28").atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
        }
    }
}
