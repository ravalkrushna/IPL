package com.example.ipl_backend.controller

import com.example.ipl_backend.model.IplMatches
import com.example.ipl_backend.model.SquadPlayers
import com.example.ipl_backend.model.Squads
import com.example.ipl_backend.repository.PlayerFantasyTotalsRepository
import com.example.ipl_backend.repository.PlayerMatchPerformanceRepository
import com.example.ipl_backend.repository.PlayerRepository
import com.example.ipl_backend.repository.SquadRepository
import com.example.ipl_backend.service.FantasyCronService
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.transaction
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

// ── Response DTOs ─────────────────────────────────────────────────────────────

data class TeamLeaderboardEntry(
    val rank: Int,
    val teamName: String,
    val totalPoints: Int,
    val playerCount: Int,
    val topPlayer: String?,
    val topPlayerPoints: Int
)

data class PlayerLeaderboardEntry(
    val rank: Int,
    val playerName: String,
    val iplTeam: String?,
    val auctionTeam: String?,
    val totalPoints: Int,
    val matchBreakdown: Map<String, Int>   // "KKR vs RCB" -> points
)

data class MatchListEntry(
    val matchId: String,
    val matchLabel: String,                // "KKR vs RCB"
    val matchNo: Int,
    val matchDate: Long
)

@RestController
@RequestMapping("/api/v1/fantasy")
class FantasyLeaderboardController(
    private val playerRepository: PlayerRepository,
    private val performanceRepository: PlayerMatchPerformanceRepository,
    private val fantasyTotalsRepository: PlayerFantasyTotalsRepository,
    private val squadRepository: SquadRepository,
    private val cronService: FantasyCronService
) {

    // ── Build UUID -> "TeamA vs TeamB" label map from ipl_matches ────────────

    private fun buildMatchLabelMap(): Map<String, String> =
        transaction {
            IplMatches.selectAll()
                .associate { row ->
                    val id    = row[IplMatches.id]
                    val teamA = row[IplMatches.teamA].abbreviate()
                    val teamB = row[IplMatches.teamB].abbreviate()
                    id to "$teamA vs $teamB"
                }
        }

    // Shorten team names to short codes for readability
    private fun String.abbreviate(): String = when (this.lowercase()) {
        "kolkata knight riders"       -> "KKR"
        "royal challengers bengaluru",
        "royal challengers bangalore" -> "RCB"
        "sunrisers hyderabad"         -> "SRH"
        "rajasthan royals"            -> "RR"
        "mumbai indians"              -> "MI"
        "chennai super kings"         -> "CSK"
        "lucknow super giants"        -> "LSG"
        "delhi capitals"              -> "DC"
        "gujarat titans"              -> "GT"
        "punjab kings"                -> "PBKS"
        else                          -> this
    }

    // ── Fetch squad name per player ───────────────────────────────────────────

    private data class SquadPlayerLink(val playerId: String, val squadName: String)

    private fun fetchSquadPlayerLinks(): List<SquadPlayerLink> =
        transaction {
            (SquadPlayers innerJoin Squads)
                .selectAll()
                .map { row ->
                    SquadPlayerLink(
                        playerId  = row[SquadPlayers.playerId],
                        squadName = row[Squads.name]
                    )
                }
        }

    // ── Team Leaderboard ──────────────────────────────────────────────────────
    // GET /api/v1/fantasy/leaderboard/teams

    @GetMapping("/leaderboard/teams")
    fun teamLeaderboard(): ResponseEntity<List<TeamLeaderboardEntry>> {
        val allPlayers       = playerRepository.findAll().associateBy { it.id }
        val allTotals        = fantasyTotalsRepository.findAll()
        val squadLinks       = fetchSquadPlayerLinks()
        val totalsByPlayerId = allTotals.associateBy { it.playerId }
        val byTeam           = squadLinks.groupBy { it.squadName }

        val leaderboard = byTeam.map { (teamName, links) ->
            val playerTotals = links.mapNotNull { link ->
                val total  = totalsByPlayerId[link.playerId]
                val player = allPlayers[link.playerId]
                if (total != null && player != null)
                    Pair(player.name, total.totalPoints)
                else null
            }
            val totalPoints = playerTotals.sumOf { it.second }
            val topPlayer   = playerTotals.maxByOrNull { it.second }

            TeamLeaderboardEntry(
                rank            = 0,
                teamName        = teamName,
                totalPoints     = totalPoints,
                playerCount     = links.size,
                topPlayer       = topPlayer?.first,
                topPlayerPoints = topPlayer?.second ?: 0
            )
        }
            .sortedByDescending { it.totalPoints }
            .mapIndexed { idx, entry -> entry.copy(rank = idx + 1) }

        return ResponseEntity.ok(leaderboard)
    }

    // ── Individual Player Leaderboard ─────────────────────────────────────────
    // GET /api/v1/fantasy/leaderboard/players?limit=50

    @GetMapping("/leaderboard/players")
    fun playerLeaderboard(
        @RequestParam(defaultValue = "50") limit: Int
    ): ResponseEntity<List<PlayerLeaderboardEntry>> {
        val allPlayers   = playerRepository.findAll().associateBy { it.id }
        val allTotals    = fantasyTotalsRepository.findAll()
            .sortedByDescending { it.totalPoints }
            .take(limit)
        val allPerfs     = performanceRepository.findAllPerformances()
        val squadLinks   = fetchSquadPlayerLinks().associateBy { it.playerId }
        val matchLabels  = buildMatchLabelMap()

        val perfsByPlayerId = allPerfs.groupBy { it.playerId }

        val leaderboard = allTotals.mapIndexed { idx, total ->
            val player    = allPlayers[total.playerId]
            val perfs     = perfsByPlayerId[total.playerId] ?: emptyList()

            // Use readable label; fall back to UUID if match not found
            val breakdown = perfs.associate { perf ->
                val label = matchLabels[perf.matchId] ?: perf.matchId
                label to perf.fantasyPoints
            }

            PlayerLeaderboardEntry(
                rank           = idx + 1,
                playerName     = player?.name ?: "Unknown",
                iplTeam        = player?.iplTeam,
                auctionTeam    = squadLinks[total.playerId]?.squadName,
                totalPoints    = total.totalPoints,
                matchBreakdown = breakdown
            )
        }

        return ResponseEntity.ok(leaderboard)
    }

    // ── Match List ────────────────────────────────────────────────────────────
    // GET /api/v1/fantasy/matches

    @GetMapping("/matches")
    fun matchList(): ResponseEntity<List<MatchListEntry>> {
        val matchedIds = performanceRepository.findAllPerformances()
            .map { it.matchId }
            .toSet()

        val matches = transaction {
            IplMatches.selectAll()
                .filter { it[IplMatches.id] in matchedIds }
                .map { row ->
                    MatchListEntry(
                        matchId    = row[IplMatches.id],
                        matchLabel = "${row[IplMatches.teamA].abbreviate()} vs ${row[IplMatches.teamB].abbreviate()}",
                        matchNo    = row[IplMatches.matchNo],
                        matchDate  = row[IplMatches.matchDate]
                    )
                }
                .sortedWith(compareBy({ it.matchNo }, { it.matchDate }))
        }

        return ResponseEntity.ok(matches)
    }

    // ── Single Player Match Breakdown ─────────────────────────────────────────
    // GET /api/v1/fantasy/player/{playerId}/breakdown

    @GetMapping("/player/{playerId}/breakdown")
    fun playerBreakdown(@PathVariable playerId: String): ResponseEntity<PlayerLeaderboardEntry> {
        val player = playerRepository.findById(playerId)
            ?: return ResponseEntity.notFound().build()

        val total     = fantasyTotalsRepository.findByPlayerIds(listOf(playerId)).firstOrNull()
        val perfs     = performanceRepository.findByPlayerId(playerId)
        val squadName = fetchSquadPlayerLinks().firstOrNull { it.playerId == playerId }?.squadName
        val matchLabels = buildMatchLabelMap()

        val breakdown = perfs.associate { perf ->
            val label = matchLabels[perf.matchId] ?: perf.matchId
            label to perf.fantasyPoints
        }

        return ResponseEntity.ok(
            PlayerLeaderboardEntry(
                rank           = 0,
                playerName     = player.name,
                iplTeam        = player.iplTeam,
                auctionTeam    = squadName,
                totalPoints    = total?.totalPoints ?: 0,
                matchBreakdown = breakdown
            )
        )
    }

    // ── Manual trigger ────────────────────────────────────────────────────────
    // POST /api/v1/fantasy/sync

    @PostMapping("/sync")
    fun manualSync(
        @RequestParam(name = "matchId", required = false) matchId: String?
    ): ResponseEntity<Map<String, Any?>> {
        val r = cronService.triggerManually(matchId)
        return ResponseEntity.ok(
            mapOf(
                "ok"                         to r.ok,
                "message"                    to r.message,
                "performancesSaved"          to r.performancesSaved,
                "playersSkippedNotInDb"      to r.playersSkippedNotInDb,
                "playersSkippedAlreadySaved" to r.playersSkippedAlreadySaved,
                "matchId"                    to r.matchId,
                "matchLabel"                 to r.matchLabel,
                "reason"                     to r.reason
            )
        )
    }
}