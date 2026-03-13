package com.example.ipl_backend.service

import com.example.ipl_backend.model.UpcomingMatch
import com.example.ipl_backend.repository.UpcomingMatchRepository
import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.web.client.RestTemplate
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneOffset

// ── API Response Models ───────────────────────────────────────────────────────

@JsonIgnoreProperties(ignoreUnknown = true)
data class CricApiMatchListResponse(
    val status: String = "",
    val data: List<CricApiMatch> = emptyList()
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class CricApiMatch(
    val id: String = "",
    val name: String = "",
    val matchType: String = "",
    val status: String = "",
    val venue: String = "",
    val date: String = "",
    val dateTimeGMT: String = "",
    val teams: List<String> = emptyList(),
    val score: List<CricApiScore>? = emptyList()   // nullable — upcoming matches have no score
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class CricApiScore(
    val r: Int = 0,
    val w: Int = 0,
    val o: Double = 0.0,
    val inning: String = ""
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class CricApiScorecardResponse(
    val status: String = "",
    val data: CricApiScorecard? = null
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class CricApiScorecard(
    val id: String = "",
    val name: String = "",
    val matchType: String = "",
    val status: String = "",
    val venue: String = "",
    val date: String = "",
    val teams: List<String> = emptyList(),
    val score: List<CricApiScore>? = emptyList(),
    val scorecard: List<CricApiInnings> = emptyList()
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class CricApiInnings(
    val inning: String = "",
    val batting: List<CricApiBatter> = emptyList(),
    val bowling: List<CricApiBowler> = emptyList(),
    val wickets: List<CricApiWicket> = emptyList()
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class CricApiBatter(
    val batsman: String = "",
    val dismissal: String = "",
    val r: Int = 0,
    val b: Int = 0,
    val fours: Int = 0,
    val sixes: Int = 0,
    val sr: String = ""
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class CricApiBowler(
    val bowler: String = "",
    val o: String = "",
    val m: Int = 0,
    val r: Int = 0,
    val w: Int = 0,
    val eco: String = ""
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class CricApiWicket(
    val player: String = "",
    val dismissal: String = "",
    val bowler: String = "",
    val fielder: String = ""
)

// ── Scraped models (used by FantasyCronService) ───────────────────────────────

data class ScrapedPlayerStats(
    val playerName: String,
    val runs: Int            = 0,
    val ballsFaced: Int      = 0,
    val fours: Int           = 0,
    val sixes: Int           = 0,
    val dismissed: Boolean   = false,
    val oversBowled: Double  = 0.0,
    val runsGiven: Int       = 0,
    val wickets: Int         = 0,
    val maidens: Int         = 0,
    val lbwBowledCount: Int  = 0,
    val catches: Int         = 0,
    val stumpings: Int       = 0,
    val runOutsDirect: Int   = 0,
    val runOutsIndirect: Int = 0,
    val playingXi: Boolean   = true
)

data class ScrapedMatch(
    val matchLabel: String,
    val matchNumber: Int,
    val team1: String,
    val team2: String,
    val date: String,
    val players: List<ScrapedPlayerStats>
)

// ── Service ───────────────────────────────────────────────────────────────────

@Service
class IplScraperService(
    private val upcomingMatchRepository: UpcomingMatchRepository
) {

    private val log          = LoggerFactory.getLogger(javaClass)
    private val restTemplate = RestTemplate()

    companion object {
        const val API_KEY  = "0671144c-cd6a-42cf-a814-038599fb1a4e"
        const val BASE_URL = "https://api.cricapi.com/v1"
        const val SEASON   = "2026"
    }

    // ── Entry point for completed match scraping ──────────────────────────────

    fun scrapeLatestMatch(): ScrapedMatch? {
        return try {
            val yesterday = LocalDate.now().minusDays(1).toString()
            log.info("Looking for IPL match on $yesterday")

            val match = findIplMatch(yesterday)
            if (match == null) {
                log.warn("No completed IPL match found for $yesterday")
                return null
            }

            log.info("Found: ${match.name} (id=${match.id})")
            fetchScorecard(match)

        } catch (e: Exception) {
            log.error("CricAPI error: ${e.message}", e)
            null
        }
    }

    // ── Sync upcoming IPL matches into upcoming_matches table ─────────────────

    fun syncUpcomingMatches(): Int {
        return try {
            val url = "$BASE_URL/matches?apikey=$API_KEY&offset=0"
            val response = restTemplate.getForObject(url, CricApiMatchListResponse::class.java)
                ?: return 0

            if (response.status != "success") {
                log.warn("CricAPI status: ${response.status}")
                return 0
            }

            // ── Debug: log all IPL-related matches with their raw status ──────
            val iplRelated = response.data.filter { match ->
                match.name.contains("IPL", ignoreCase = true) ||
                        IPL_TEAMS.any { team -> match.name.contains(team, ignoreCase = true) }
            }

            log.info("=== CricAPI IPL matches debug (${iplRelated.size} found) ===")
            iplRelated.forEach { match ->
                log.info("  name='${match.name}' | status='${match.status}' | date='${match.date}' | dateTimeGMT='${match.dateTimeGMT}'")
            }
            log.info("=== End debug ===")

            // ── Filter: keep only matches that are NOT finished ───────────────
            // Intentionally lenient — catches "Match not started", "", "Toss", etc.
            val upcoming = iplRelated.filter { match ->
                val s = match.status.lowercase().trim()
                !s.contains("won") &&
                        !s.contains("tied") &&
                        !s.contains("no result") &&
                        !s.equals("completed")
            }

            log.info("${upcoming.size} upcoming IPL matches after filtering")

            var saved = 0
            upcoming.forEach { match ->
                try {
                    val (team1, team2) = parseTeams(match.name)
                    val matchNo        = extractMatchNumber(match.name)
                    val epochMs        = parseMatchDate(match.dateTimeGMT.ifBlank { match.date })

                    val record = UpcomingMatch(
                        id        = match.id,
                        matchNo   = matchNo,
                        teamA     = team1,
                        teamB     = team2,
                        matchDate = epochMs,
                        season    = SEASON,
                        createdAt = Instant.now().toEpochMilli()
                    )

                    if (upcomingMatchRepository.saveIfAbsent(record)) {
                        log.info("  Saved: Match $matchNo — $team1 vs $team2 on ${match.date}")
                        saved++
                    } else {
                        log.debug("  Already exists: Match $matchNo — $team1 vs $team2")
                    }

                } catch (e: Exception) {
                    log.warn("  Skipped '${match.name}': ${e.message}")
                }
            }

            log.info("syncUpcomingMatches complete — $saved new records inserted")
            saved

        } catch (e: Exception) {
            log.error("syncUpcomingMatches failed: ${e.message}", e)
            0
        }
    }

    // ── Step 1: Find yesterday's completed IPL match ──────────────────────────

    private fun findIplMatch(date: String): CricApiMatch? {
        val url = "$BASE_URL/matches?apikey=$API_KEY&offset=0"
        val response = restTemplate.getForObject(url, CricApiMatchListResponse::class.java)
            ?: return null

        if (response.status != "success") {
            log.warn("CricAPI matches status: ${response.status}")
            return null
        }

        return response.data.firstOrNull { match ->
            val isIpl = match.name.contains("IPL", ignoreCase = true) ||
                    IPL_TEAMS.any { team -> match.name.contains(team, ignoreCase = true) }
            val isYesterday = match.date == date || match.dateTimeGMT.startsWith(date)
            val isCompleted = match.status.contains("won", ignoreCase = true) ||
                    match.status.equals("completed", ignoreCase = true)
            isIpl && isYesterday && isCompleted
        }
    }

    // ── Step 2: Fetch full scorecard ──────────────────────────────────────────

    private fun fetchScorecard(match: CricApiMatch): ScrapedMatch? {
        val url = "$BASE_URL/match_scorecard?apikey=$API_KEY&id=${match.id}"
        val response = restTemplate.getForObject(url, CricApiScorecardResponse::class.java)
            ?: return null

        if (response.status != "success" || response.data == null) {
            log.warn("Scorecard failed for ${match.id}: ${response.status}")
            return null
        }

        val scorecard      = response.data
        val (team1, team2) = parseTeams(match.name)
        val matchNumber    = extractMatchNumber(match.name)
        val matchLabel     = "Match $matchNumber (${team1.lowercase()} vs ${team2.lowercase()})"

        log.info("Parsing $matchLabel — ${scorecard.scorecard.size} innings")

        val playerStatsMap = mutableMapOf<String, ScrapedPlayerStats>()

        scorecard.scorecard.forEach { innings ->
            processBatting(innings, playerStatsMap)
            processBowling(innings, playerStatsMap)
            processFielding(innings, playerStatsMap)
        }

        if (playerStatsMap.isEmpty()) {
            log.warn("No player stats extracted")
            return null
        }

        log.info("Extracted ${playerStatsMap.size} players for $matchLabel")

        return ScrapedMatch(
            matchLabel  = matchLabel,
            matchNumber = matchNumber,
            team1       = team1,
            team2       = team2,
            date        = match.date,
            players     = playerStatsMap.values.toList()
        )
    }

    // ── Batting ───────────────────────────────────────────────────────────────

    private fun processBatting(innings: CricApiInnings, statsMap: MutableMap<String, ScrapedPlayerStats>) {
        innings.batting.forEach { batter ->
            val name = batter.batsman.trim()
            if (name.isBlank()) return@forEach

            val dismissed = batter.dismissal.isNotBlank() &&
                    !batter.dismissal.equals("not out", ignoreCase = true) &&
                    !batter.dismissal.equals("dnb", ignoreCase = true)

            val existing = statsMap[name] ?: ScrapedPlayerStats(name)
            statsMap[name] = existing.copy(
                runs       = batter.r,
                ballsFaced = batter.b,
                fours      = batter.fours,
                sixes      = batter.sixes,
                dismissed  = dismissed
            )
        }
    }

    // ── Bowling ───────────────────────────────────────────────────────────────

    private fun processBowling(innings: CricApiInnings, statsMap: MutableMap<String, ScrapedPlayerStats>) {
        innings.bowling.forEach { bowler ->
            val name = bowler.bowler.trim()
            if (name.isBlank()) return@forEach

            val existing = statsMap[name] ?: ScrapedPlayerStats(name)
            statsMap[name] = existing.copy(
                oversBowled = bowler.o.toDoubleOrNull() ?: 0.0,
                runsGiven   = bowler.r,
                wickets     = bowler.w,
                maidens     = bowler.m
            )
        }
    }

    // ── Fielding from wickets list ────────────────────────────────────────────

    private fun processFielding(innings: CricApiInnings, statsMap: MutableMap<String, ScrapedPlayerStats>) {
        innings.wickets.forEach { wicket ->
            val dismissal = wicket.dismissal.lowercase().trim()
            val fielder   = wicket.fielder.trim()
            val bowler    = wicket.bowler.trim()

            when {
                dismissal == "lbw" || dismissal == "bowled" -> {
                    if (bowler.isNotBlank()) {
                        val e = statsMap[bowler] ?: ScrapedPlayerStats(bowler)
                        statsMap[bowler] = e.copy(lbwBowledCount = e.lbwBowledCount + 1)
                    }
                }
                dismissal == "caught" -> {
                    if (fielder.isNotBlank()) {
                        val e = statsMap[fielder] ?: ScrapedPlayerStats(fielder)
                        statsMap[fielder] = e.copy(catches = e.catches + 1)
                    }
                }
                dismissal == "stumped" -> {
                    if (fielder.isNotBlank()) {
                        val e = statsMap[fielder] ?: ScrapedPlayerStats(fielder)
                        statsMap[fielder] = e.copy(stumpings = e.stumpings + 1)
                    }
                }
                dismissal.contains("run out") -> {
                    if (fielder.contains("/")) {
                        fielder.split("/").forEach { f ->
                            val n = f.trim()
                            if (n.isNotBlank()) {
                                val e = statsMap[n] ?: ScrapedPlayerStats(n)
                                statsMap[n] = e.copy(runOutsIndirect = e.runOutsIndirect + 1)
                            }
                        }
                    } else if (fielder.isNotBlank()) {
                        val e = statsMap[fielder] ?: ScrapedPlayerStats(fielder)
                        statsMap[fielder] = e.copy(runOutsDirect = e.runOutsDirect + 1)
                    }
                }
            }
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun parseMatchDate(dateStr: String): Long {
        return try {
            if (dateStr.contains("T")) {
                LocalDateTime.parse(dateStr)
                    .toInstant(ZoneOffset.UTC)
                    .toEpochMilli()
            } else {
                LocalDate.parse(dateStr)
                    .atStartOfDay(ZoneOffset.UTC)
                    .toInstant()
                    .toEpochMilli()
            }
        } catch (e: Exception) {
            log.warn("Could not parse date '$dateStr', using now")
            Instant.now().toEpochMilli()
        }
    }

    private fun parseTeams(matchName: String): Pair<String, String> {
        val vsRegex = Regex("(.+?)\\s+vs\\.?\\s+(.+?)(?:,|$)", RegexOption.IGNORE_CASE)
        val m = vsRegex.find(matchName)
        val team1 = m?.groupValues?.get(1)?.trim()?.let { fullNameToShort(it) } ?: "TBD"
        val team2 = m?.groupValues?.get(2)?.trim()?.let { fullNameToShort(it) } ?: "TBD"
        return Pair(team1, team2)
    }

    private fun extractMatchNumber(matchName: String): Int =
        Regex("match\\s*(\\d+)", RegexOption.IGNORE_CASE)
            .find(matchName)?.groupValues?.get(1)?.toIntOrNull() ?: 1

    private fun fullNameToShort(name: String): String =
        IPL_SHORT_NAMES[name.trim()] ?: name.trim()
            .split(" ").map { it.take(3) }
            .joinToString("").uppercase().take(4)

    private val IPL_TEAMS = listOf(
        "Mumbai Indians", "Chennai Super Kings", "Royal Challengers",
        "Kolkata Knight Riders", "Delhi Capitals", "Punjab Kings",
        "Rajasthan Royals", "Sunrisers Hyderabad", "Gujarat Titans",
        "Lucknow Super Giants"
    )

    private val IPL_SHORT_NAMES = mapOf(
        "Mumbai Indians"              to "MI",
        "Chennai Super Kings"         to "CSK",
        "Royal Challengers Bengaluru" to "RCB",
        "Royal Challengers Bangalore" to "RCB",
        "Kolkata Knight Riders"       to "KKR",
        "Delhi Capitals"              to "DC",
        "Punjab Kings"                to "PBKS",
        "Rajasthan Royals"            to "RR",
        "Sunrisers Hyderabad"         to "SRH",
        "Gujarat Titans"              to "GT",
        "Lucknow Super Giants"        to "LSG"
    )
}