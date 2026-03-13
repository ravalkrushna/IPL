package com.example.ipl_backend.service

import com.example.ipl_backend.dto.*
import com.example.ipl_backend.model.Player
import com.example.ipl_backend.model.Squad
import com.example.ipl_backend.repository.*
import org.jetbrains.exposed.sql.transactions.transaction
import org.springframework.stereotype.Service

@Service
class FantasyService(
    private val squadRepository: SquadRepository,
    private val playerRepository: PlayerRepository,
    private val iplMatchRepository: IplMatchRepository,
    private val performanceRepository: PlayerMatchPerformanceRepository,
    private val fantasyTotalRepository: PlayerFantasyTotalsRepository
) {

    // ── Leaderboard ───────────────────────────────────────────────────────────

    fun getLeaderboard(auctionId: String): FantasyLeaderboardResponse {
        val squads = squadRepository.findByAuction(auctionId)
        val allPlayerIds = squads.flatMap { squadRepository.getPlayers(it.id).map { p -> p.id } }
        val totals = fantasyTotalRepository.findByPlayerIds(allPlayerIds).associateBy { it.playerId }

        val squadPoints = squads.map { squad: Squad ->
            val players = squadRepository.getPlayers(squad.id)
            var points = 0
            var matches = 0
            for (player in players) {
                val total = totals[player.id]
                if (total != null) {
                    points += total.totalPoints
                    if (total.matchesPlayed > matches) matches = total.matchesPlayed
                }
            }
            Triple(squad, points, matches)
        }.sortedByDescending { it.second }

        val entries = squadPoints.mapIndexed { index, triple ->
            val squad: Squad = triple.first
            val points: Int  = triple.second
            val matches: Int = triple.third
            val participantName = getParticipantName(squad.participantId.toString())
            FantasyLeaderboardEntry(
                rank            = index + 1,
                squadId         = squad.id,
                squadName       = squad.name,
                participantName = participantName,
                totalPoints     = points,
                matchesPlayed   = matches
            )
        }

        return FantasyLeaderboardResponse(auctionId = auctionId, entries = entries)
    }

    // ── Squad breakdown ───────────────────────────────────────────────────────

    fun getSquadFantasy(squadId: String): FantasySquadResponse? {
        val squad: Squad = squadRepository.findById(squadId) ?: return null
        val squadPlayerDetails = squadRepository.getSquadPlayersBySquadId(squadId)
        val playerIds = squadPlayerDetails.map { it.id }
        val totals = fantasyTotalRepository.findByPlayerIds(playerIds).associateBy { it.playerId }

        val playerEntries = squadPlayerDetails.map { detail ->
            val player: Player? = playerRepository.findById(detail.id)
            val total = totals[detail.id]
            FantasySquadPlayerEntry(
                playerId      = detail.id,
                playerName    = detail.name,
                specialism    = player?.specialism ?: "UNKNOWN",
                iplTeam       = player?.iplTeam ?: "",
                soldPrice     = detail.soldPrice,
                totalPoints   = total?.totalPoints ?: 0,
                matchesPlayed = total?.matchesPlayed ?: 0
            )
        }.sortedByDescending { it.totalPoints }

        return FantasySquadResponse(
            squadId     = squadId,
            squadName   = squad.name,
            auctionId   = squad.auctionId,
            totalPoints = playerEntries.sumOf { it.totalPoints },
            players     = playerEntries
        )
    }

    // ── Player match-by-match (IPL 2026 current season only) ─────────────────
    // Used by the live fantasy competition view — shows only the current season.

    fun getPlayerFantasy(playerId: String): FantasyPlayerResponse? {
        val player: Player = playerRepository.findById(playerId) ?: return null

        val season2026MatchIds = iplMatchRepository.findBySeason("2026").map { it.id }.toSet()
        val performances = performanceRepository.findByPlayerId(playerId)
            .filter { it.matchId in season2026MatchIds }

        val matchEntries = performances.mapNotNull { perf ->
            val match = iplMatchRepository.findById(perf.matchId) ?: return@mapNotNull null
            FantasyPlayerMatchEntry(
                matchId         = match.id,
                matchNo         = match.matchNo,
                teamA           = match.teamA,
                teamB           = match.teamB,
                matchDate       = match.matchDate,
                runs            = perf.runs,
                ballsFaced      = perf.ballsFaced,
                fours           = perf.fours,
                sixes           = perf.sixes,
                dismissed       = perf.dismissed,
                wickets         = perf.wickets,
                catches         = perf.catches,
                stumpings       = perf.stumpings,
                runOutsDirect   = perf.runOutsDirect,
                runOutsIndirect = perf.runOutsIndirect,
                fantasyPoints   = perf.fantasyPoints
            )
        }.sortedBy { it.matchDate }

        return FantasyPlayerResponse(
            playerId      = playerId,
            playerName    = player.name,
            iplTeam       = player.iplTeam ?: "",
            specialism    = player.specialism ?: "UNKNOWN",
            totalPoints   = matchEntries.sumOf { it.fantasyPoints },
            matchesPlayed = matchEntries.size,
            matches       = matchEntries
        )
    }

    // ── Match performances ────────────────────────────────────────────────────

    fun getMatchFantasy(matchId: String): FantasyMatchResponse? {
        val match = iplMatchRepository.findById(matchId) ?: return null
        val performances = performanceRepository.findByMatchId(matchId)

        val playerEntries = performances.mapNotNull { perf ->
            val player: Player = playerRepository.findById(perf.playerId) ?: return@mapNotNull null
            FantasyMatchPlayerEntry(
                playerId        = player.id,
                playerName      = player.name,
                iplTeam         = player.iplTeam ?: "",
                specialism      = player.specialism ?: "UNKNOWN",
                runs            = perf.runs,
                ballsFaced      = perf.ballsFaced,
                fours           = perf.fours,
                sixes           = perf.sixes,
                dismissed       = perf.dismissed,
                wickets         = perf.wickets,
                lbwBowledCount  = perf.lbwBowledCount,
                oversBowled     = perf.oversBowled,
                runsGiven       = perf.runsGiven,
                maidens         = perf.maidens,
                catches         = perf.catches,
                stumpings       = perf.stumpings,
                runOutsDirect   = perf.runOutsDirect,
                runOutsIndirect = perf.runOutsIndirect,
                fantasyPoints   = perf.fantasyPoints
            )
        }.sortedByDescending { it.fantasyPoints }

        return FantasyMatchResponse(
            matchId      = matchId,
            matchNo      = match.matchNo,
            teamA        = match.teamA,
            teamB        = match.teamB,
            matchDate    = match.matchDate,
            performances = playerEntries
        )
    }

    // ── IPL 2025 Previous Season Stats (Auction Reference) ───────────────────
    //
    // Returns IPL 2025-only stats for a player, scoped to matches where season
    // is null (legacy 2025 seeded data). This is what gets shown on the player
    // card during the auction so bidders can evaluate past performance.
    // It deliberately excludes 2026 data so the two purposes never mix.

    fun getIplCareer(playerId: String): IplCareerStats {
        val player = playerRepository.findById(playerId)

        // 2025 data was seeded with season = null in ipl_matches
        val ipl2025MatchIds = iplMatchRepository.findAll()
            .filter { it.season == null || it.season == "2025" }
            .map { it.id }
            .toSet()

        val performances = performanceRepository.findByPlayerId(playerId)
            .filter { it.matchId in ipl2025MatchIds }

        if (performances.isEmpty()) return IplCareerStats(
            playerName     = player?.name ?: playerId,
            iplTeam        = player?.iplTeam ?: "",
            specialism     = player?.specialism ?: "UNKNOWN",
            season         = "2025",
            matchesPlayed  = 0,
            totalRuns      = 0,
            highScore      = 0,
            battingAverage = 0.0,
            strikeRate     = 0.0,
            totalFours     = 0,
            totalSixes     = 0,
            totalWickets   = 0,
            bowlingEconomy = 0.0,
            totalCatches   = 0,
            totalStumpings = 0,
            fantasyPoints  = 0
        )

        val matches        = performances.size
        val totalRuns      = performances.sumOf { it.runs }
        val highScore      = performances.maxOf { it.runs }
        val dismissals     = performances.count { it.dismissed }
        val ballsFaced     = performances.sumOf { it.ballsFaced }
        val totalWickets   = performances.sumOf { it.wickets }
        val totalOvers     = performances.sumOf { it.oversBowled.toDouble() }
        val runsGiven      = performances.sumOf { it.runsGiven }
        val totalCatches   = performances.sumOf { it.catches }
        val totalStumpings = performances.sumOf { it.stumpings }
        val totalFours     = performances.sumOf { it.fours }
        val totalSixes     = performances.sumOf { it.sixes }
        val fantasyPoints  = performances.sumOf { it.fantasyPoints }

        val avg  = if (dismissals > 0) totalRuns.toDouble() / dismissals else totalRuns.toDouble()
        val sr   = if (ballsFaced > 0) (totalRuns.toDouble() / ballsFaced) * 100 else 0.0
        val econ = if (totalOvers > 0) runsGiven.toDouble() / totalOvers else 0.0

        return IplCareerStats(
            playerName     = player?.name ?: playerId,
            iplTeam        = player?.iplTeam ?: "",
            specialism     = player?.specialism ?: "UNKNOWN",
            season         = "2025",
            matchesPlayed  = matches,
            totalRuns      = totalRuns,
            highScore      = highScore,
            battingAverage = Math.round(avg * 100.0) / 100.0,
            strikeRate     = Math.round(sr * 100.0) / 100.0,
            totalFours     = totalFours,
            totalSixes     = totalSixes,
            totalWickets   = totalWickets,
            bowlingEconomy = Math.round(econ * 100.0) / 100.0,
            totalCatches   = totalCatches,
            totalStumpings = totalStumpings,
            fantasyPoints  = fantasyPoints
        )
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun getParticipantName(participantId: String): String {
        return transaction {
            exec("SELECT name FROM participants WHERE id = '$participantId'") { rs ->
                if (rs.next()) rs.getString("name") else null
            } ?: participantId
        }
    }
}

// Returned by GET /api/v1/fantasy/player/{id}/ipl-career
// Always shows IPL 2025 (previous season) stats so bidders can evaluate
// a player's form before bidding. Stays fixed at "2025" regardless of
// whether the 2026 season has started — no cross-season contamination.
data class IplCareerStats(
    val playerName: String,
    val iplTeam: String,
    val specialism: String,
    val season: String,
    val matchesPlayed: Int,
    val totalRuns: Int,
    val highScore: Int,
    val battingAverage: Double,
    val strikeRate: Double,
    val totalFours: Int,
    val totalSixes: Int,
    val totalWickets: Int,
    val bowlingEconomy: Double,
    val totalCatches: Int,
    val totalStumpings: Int,
    val fantasyPoints: Int
)