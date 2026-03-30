package com.example.ipl_backend.service

import com.example.ipl_backend.model.*
import com.example.ipl_backend.repository.*
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.stereotype.Service
import java.io.BufferedInputStream
import java.math.BigDecimal
import java.net.URI
import java.time.LocalDate
import java.time.ZoneOffset
import java.util.*
import java.util.zip.ZipInputStream

@Service
class Ipl2025SeederService(
    private val playerRepository: PlayerRepository,
    private val playerNameAliasRepository: PlayerNameAliasRepository,
    private val iplMatchRepository: IplMatchRepository,
    private val performanceRepository: PlayerMatchPerformanceRepository,
    private val fantasyTotalRepository: PlayerFantasyTotalsRepository,
    private val squadRepository: SquadRepository,
    private val fantasyPointsCalculator: FantasyPointsCalculator,
    private val objectMapper: ObjectMapper
) {

    companion object {
        private const val CRICSHEET_IPL_URL = "https://cricsheet.org/downloads/ipl_json.zip"
    }

    private data class PlayerStats(
        var runs: Int = 0,
        var ballsFaced: Int = 0,
        var fours: Int = 0,
        var sixes: Int = 0,
        var dismissed: Boolean = false,
        var wickets: Int = 0,
        var lbwBowledCount: Int = 0,
        var ballsBowled: Int = 0,
        var runsGiven: Int = 0,
        var maidens: Int = 0,
        var dotBalls: Int = 0,
        var catches: Int = 0,
        var stumpings: Int = 0,
        var runOutsDirect: Int = 0,
        var runOutsIndirect: Int = 0,
        var playingXi: Boolean = false
    )

    data class SeedResult(val success: Boolean, val message: String)
    private data class MatchResult(val matched: Int, val unmatched: Int)

    // ─────────────────────────────────────────────────────────────────────
    // Main entry point
    // ─────────────────────────────────────────────────────────────────────
    fun seedIpl2025(): SeedResult {
        println("📥 Downloading IPL JSON from cricsheet.org...")

        val zipBytes = try {
            URI.create(CRICSHEET_IPL_URL).toURL().openStream().use { it.readBytes() }
        } catch (e: Exception) {
            return SeedResult(success = false, message = "Failed to download: ${e.message}")
        }

        println("✅ Download complete. Parsing match files...")

        var matchesProcessed = 0
        var matchesFailed    = 0
        var playersMatched   = 0
        var playersUnmatched = 0

        ZipInputStream(BufferedInputStream(zipBytes.inputStream())).use { zip ->
            var entry = zip.nextEntry
            while (entry != null) {
                if (!entry.isDirectory && entry.name.endsWith(".json")) {
                    val bytes = zip.readBytes()
                    try {
                        val json: JsonNode = objectMapper.readTree(bytes)
                        val season = json.path("info").path("season").asText("")

                        if (season == "2025") {
                            val result = processMatch(json)
                            playersMatched   += result.matched
                            playersUnmatched += result.unmatched
                            matchesProcessed++
                        }
                    } catch (e: Exception) {
                        println("  ❌ Failed to process ${entry.name}: ${e.message}")
                        matchesFailed++
                    }
                }
                zip.closeEntry()
                entry = zip.nextEntry
            }
        }

        val msg = """
            🎉 IPL 2025 seed complete!
               ✅ Matches processed : $matchesProcessed
               ⚠️  Matches failed    : $matchesFailed
               👤 Players matched   : $playersMatched
               ❓ Players unmatched : $playersUnmatched
        """.trimIndent()

        println(msg)
        return SeedResult(success = true, message = msg)
    }

    // ─────────────────────────────────────────────────────────────────────
    // Process a single match JSON node
    // ─────────────────────────────────────────────────────────────────────
    private fun processMatch(json: JsonNode): MatchResult {
        val info: JsonNode = json.path("info")

        val teamsNode: JsonNode = info.path("teams")
        val teamA = teamsNode.get(0)?.asText() ?: return MatchResult(0, 0)
        val teamB = teamsNode.get(1)?.asText() ?: return MatchResult(0, 0)

        val dateStr = info.path("dates").get(0)?.asText() ?: return MatchResult(0, 0)
        val matchNo = info.path("event").path("match_number").asInt(0)
        val matchDate = LocalDate.parse(dateStr)
            .atStartOfDay()
            .toInstant(ZoneOffset.UTC)
            .toEpochMilli()

        // Skip if already seeded
        if (iplMatchRepository.findByTeamsAndDate(teamA, teamB, matchDate) != null) {
            println("  ⏭️  Already seeded: $teamA vs $teamB ($dateStr)")
            return MatchResult(0, 0)
        }

        // ── Playing XI ────────────────────────────────────────────────────
        val playingXiNames = mutableSetOf<String>()
        val playersNode: JsonNode = info.path("players")
        val teamFields = playersNode.fields()
        while (teamFields.hasNext()) {
            val teamEntry: Map.Entry<String, JsonNode> = teamFields.next()
            teamEntry.value.forEach { playerNode: JsonNode ->
                playingXiNames.add(playerNode.asText())
            }
        }

        // ── Aggregate ball-by-ball stats ──────────────────────────────────
        val statsMap = mutableMapOf<String, PlayerStats>()

        playingXiNames.forEach { name ->
            statsMap.getOrPut(name) { PlayerStats() }.playingXi = true
        }

        val innings: JsonNode = json.path("innings")
        innings.forEach { inning: JsonNode ->
            inning.path("overs").forEach { over: JsonNode ->
                val overDeliveries: JsonNode = over.path("deliveries")
                var maidenRuns = 0

                overDeliveries.forEach { delivery: JsonNode ->
                    val batter   = delivery.path("batter").asText()
                    val bowler   = delivery.path("bowler").asText()
                    val runsNode: JsonNode = delivery.path("runs")
                    val batRuns  = runsNode.path("batter").asInt(0)
                    val extras   = runsNode.path("extras").asInt(0)
                    val totalRuns = runsNode.path("total").asInt(0)

                    maidenRuns += totalRuns

                    // ── Batting ───────────────────────────────────────────
                    val batterStats = statsMap.getOrPut(batter) { PlayerStats() }
                    batterStats.runs       += batRuns
                    batterStats.ballsFaced += 1
                    if (batRuns == 4) batterStats.fours++
                    if (batRuns == 6) batterStats.sixes++

                    // ── Bowling ───────────────────────────────────────────
                    val bowlerStats = statsMap.getOrPut(bowler) { PlayerStats() }
                    val extrasNode: JsonNode = delivery.path("extras")
                    val isWide   = extrasNode.has("wides")
                    val isNoBall = extrasNode.has("noballs")
                    if (!isWide && !isNoBall) {
                        bowlerStats.ballsBowled++
                        if (totalRuns == 0) bowlerStats.dotBalls++
                    }
                    bowlerStats.runsGiven += batRuns + extras

                    // ── Wickets ───────────────────────────────────────────
                    val wicketsNode: JsonNode = delivery.path("wickets")
                    if (wicketsNode.isArray) {
                        wicketsNode.forEach { wicket: JsonNode ->
                            val kind      = wicket.path("kind").asText()
                            val playerOut = wicket.path("player_out").asText()

                            statsMap.getOrPut(playerOut) { PlayerStats() }.dismissed = true

                            when (kind) {
                                "caught" -> {
                                    bowlerStats.wickets++
                                    wicket.path("fielders").forEach { fielder: JsonNode ->
                                        val fn = fielder.path("name").asText()
                                        if (fn.isNotBlank()) {
                                            statsMap.getOrPut(fn) { PlayerStats() }.catches++
                                        }
                                    }
                                }
                                "bowled" -> {
                                    bowlerStats.wickets++
                                    bowlerStats.lbwBowledCount++
                                }
                                "lbw" -> {
                                    bowlerStats.wickets++
                                    bowlerStats.lbwBowledCount++
                                }
                                "stumped" -> {
                                    bowlerStats.wickets++
                                    wicket.path("fielders").forEach { fielder: JsonNode ->
                                        val fn = fielder.path("name").asText()
                                        if (fn.isNotBlank()) {
                                            statsMap.getOrPut(fn) { PlayerStats() }.stumpings++
                                        }
                                    }
                                }
                                "run out" -> {
                                    val fielders: JsonNode = wicket.path("fielders")
                                    if (fielders.size() == 1) {
                                        val fn = fielders.get(0).path("name").asText()
                                        if (fn.isNotBlank()) {
                                            statsMap.getOrPut(fn) { PlayerStats() }.runOutsDirect++
                                        }
                                    } else if (fielders.size() > 1) {
                                        fielders.forEach { fielder: JsonNode ->
                                            val fn = fielder.path("name").asText()
                                            if (fn.isNotBlank()) {
                                                statsMap.getOrPut(fn) { PlayerStats() }.runOutsIndirect++
                                            }
                                        }
                                    }
                                }
                                "caught and bowled" -> {
                                    bowlerStats.wickets++
                                    bowlerStats.catches++
                                }
                                else -> {
                                    bowlerStats.wickets++
                                }
                            }
                        }
                    }
                } // end deliveries

                // Maiden — zero runs in entire over
                if (maidenRuns == 0 && overDeliveries.size() > 0) {
                    val firstBowler = overDeliveries.get(0)?.path("bowler")?.asText()
                    if (!firstBowler.isNullOrBlank()) {
                        statsMap.getOrPut(firstBowler) { PlayerStats() }.maidens++
                    }
                }
            } // end overs
        } // end innings

        // ── Save match ────────────────────────────────────────────────────
        val matchId = UUID.randomUUID().toString()
        val now     = System.currentTimeMillis()

        iplMatchRepository.save(IplMatch(
            id          = matchId,
            matchNo     = matchNo,
            teamA       = teamA,
            teamB       = teamB,
            matchDate   = matchDate,
            cricinfoUrl = null,
            isScraped   = true,
            createdAt   = now,
            season      = "2025"
        ))

        // ── Resolve names and save performances ───────────────────────────
        var matched   = 0
        var unmatched = 0

        for ((cricsheetName, stats) in statsMap) {
            if (!stats.playingXi) continue

            val playerId = resolvePlayerId(cricsheetName)
            if (playerId == null) {
                println("    ❓ Unmatched: $cricsheetName")
                unmatched++
                continue
            }
            matched++

            val oversFull      = stats.ballsBowled / 6
            val ballsRemainder = stats.ballsBowled % 6
            val oversBowled    = BigDecimal("$oversFull.$ballsRemainder")

            val performance = PlayerMatchPerformance(
                id              = UUID.randomUUID().toString(),
                playerId        = playerId,
                matchId         = matchId,
                runs            = stats.runs,
                ballsFaced      = stats.ballsFaced,
                fours           = stats.fours,
                sixes           = stats.sixes,
                dismissed       = stats.dismissed,
                wickets         = stats.wickets,
                lbwBowledCount  = stats.lbwBowledCount,
                oversBowled     = oversBowled,
                runsGiven       = stats.runsGiven,
                maidens         = stats.maidens,
                dotBalls        = stats.dotBalls,
                catches         = stats.catches,
                stumpings       = stats.stumpings,
                runOutsDirect   = stats.runOutsDirect,
                runOutsIndirect = stats.runOutsIndirect,
                playingXi       = stats.playingXi,
                fantasyPoints   = 0,
                createdAt       = now
            )

            val points = fantasyPointsCalculator.calculate(performance)
            val performanceWithPoints = performance.copy(fantasyPoints = points)
            performanceRepository.upsert(performanceWithPoints)

            fantasyTotalRepository.addPoints(playerId, points)
        }

        println("  ✅ $teamA vs $teamB ($dateStr) — matched=$matched unmatched=$unmatched")
        return MatchResult(matched, unmatched)
    }

    // ─────────────────────────────────────────────────────────────────────
    // Resolve cricsheet name → player ID
    // ─────────────────────────────────────────────────────────────────────
    private fun resolvePlayerId(cricsheetName: String): String? {
        // 1. Alias table
        val aliasMatch = playerNameAliasRepository.findPlayerIdByName(cricsheetName)
        if (aliasMatch != null) return aliasMatch

        // 2. Exact name match
        val exactMatch = playerRepository.findByName(cricsheetName)
        if (exactMatch != null) return exactMatch.id

        // 3. Last name match
        val lastName = cricsheetName.substringAfterLast(" ")
        if (lastName.length > 3) {
            val lastNameMatch = playerRepository.findByLastName(lastName)
            if (lastNameMatch != null) return lastNameMatch.id
        }

        // 4. Initials + last name match
        val parts = cricsheetName.trim().split(" ")
        if (parts.size >= 2) {
            val firstInitial = parts.first().substring(0, 1).uppercase()
            val last         = parts.last()

            val candidates = playerRepository.findAllByLastName(last)
            val match = candidates.firstOrNull { player ->
                player.name.split(" ").first().substring(0, 1).uppercase() == firstInitial
            }
            if (match != null) return match.id
        }

        // 5. Contains / last-name fallback
        val allPlayers = playerRepository.findAll()
        val normalized = cricsheetName.lowercase().replace(Regex("[^a-z ]"), "")
        val containsMatch = allPlayers.firstOrNull { player ->
            val pNorm = player.name.lowercase().replace(Regex("[^a-z ]"), "")
            pNorm.contains(normalized) || normalized.contains(pNorm) ||
                    pNorm.split(" ").last() == normalized.split(" ").last()
        }
        if (containsMatch != null) return containsMatch.id

        return null
    }
}
