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
    private val fantasyPointsCalculator: FantasyPointsCalculator,
    private val midSeasonRepository: com.example.ipl_backend.repository.MidSeasonRepository,
    private val auctionRepository: com.example.ipl_backend.repository.AuctionRepository
) {

    // ── Leaderboard ───────────────────────────────────────────────────────────

    fun getLeaderboard(auctionId: String, season: String = "2026"): FantasyLeaderboardResponse {
        val squads = squadRepository.findByAuction(auctionId)
        val allPlayerIds = squads.flatMap { squadRepository.getPlayers(it.id).map { p -> p.id } }
        val seasonMatches = resolveSeasonMatches(season)
        val seasonMatchIds = seasonMatches.map { it.id }.toSet()
        // matchId → matchDate (epoch ms) used to apply the trade-cutoff filter below.
        val matchDateById = seasonMatches.associate { it.id to it.matchDate }
        val seasonPerformancesByPlayer = performanceRepository.findByPlayerIds(allPlayerIds)
            .filter { it.matchId in seasonMatchIds }
            .groupBy { it.playerId }

        val snapshots = midSeasonRepository.findAllSnapshots(auctionId).associateBy { it.squadId }

        val squadPoints = squads.map { squad: Squad ->
            // getSquadPlayersBySquadId includes joinedAt so we can apply the cutoff.
            val playerDetails = squadRepository.getSquadPlayersBySquadId(squad.id)
            // If the squad has a mid-season snapshot, anything before lockedAt is
            // already counted in lockedPoints — never double-count it as "new",
            // even if a player's joinedAt predates the snapshot (e.g. legacy data
            // where re-auctioned players were inserted with joinedAt = 0).
            val snapshotLockedAt = snapshots[squad.id]?.lockedAt
            var points = 0
            var matches = 0
            for (detail in playerDetails) {
                val cutoff = maxOf(detail.joinedAt, snapshotLockedAt ?: 0L)
                val playerPerfs = seasonPerformancesByPlayer[detail.id].orEmpty()
                    .filter { (matchDateById[it.matchId] ?: 0L) >= cutoff }
                points += playerPerfs.sumOf { fantasyPointsCalculator.calculate(it) }
                if (playerPerfs.size > matches) matches = playerPerfs.size
            }
            // Add locked pre-reauction points if mid-season auction happened
            val lockedPoints = snapshots[squad.id]?.lockedPoints ?: 0
            Triple(squad, points + lockedPoints, matches)
        }.sortedByDescending { it.second }

        val entries = squadPoints.mapIndexed { index, triple ->
            val squad: Squad = triple.first
            val points: Int  = triple.second
            val matches: Int = triple.third
            val participantName = getParticipantName(squad.participantId.toString())
            val locked = snapshots[squad.id]?.lockedPoints ?: 0
            FantasyLeaderboardEntry(
                rank            = index + 1,
                squadId         = squad.id,
                squadName       = squad.name,
                participantName = participantName,
                totalPoints     = points,
                matchesPlayed   = matches,
                lockedPoints    = locked,
                newPoints       = points - locked
            )
        }

        return FantasyLeaderboardResponse(auctionId = auctionId, entries = entries)
    }

    // ── Squad breakdown ───────────────────────────────────────────────────────

    fun getSquadFantasy(squadId: String, season: String = "2026"): FantasySquadResponse? {
        val squad: Squad = squadRepository.findById(squadId) ?: return null
        val snapshot = midSeasonRepository.findSnapshot(squad.auctionId, squadId)
        val lockedPoints = snapshot?.lockedPoints ?: 0
        val snapshotLockedAt = snapshot?.lockedAt
        // getSquadPlayersBySquadId includes joinedAt per player.
        val squadPlayerDetails = squadRepository.getSquadPlayersBySquadId(squadId)
        val playerIds = squadPlayerDetails.map { it.id }
        val seasonMatches = resolveSeasonMatches(season)
        val seasonMatchIds = seasonMatches.map { it.id }.toSet()
        // matchId → matchDate used to apply trade-cutoff per player.
        val matchDateById = seasonMatches.associate { it.id to it.matchDate }
        val seasonPerformancesByPlayer = performanceRepository.findByPlayerIds(playerIds)
            .filter { it.matchId in seasonMatchIds }
            .groupBy { it.playerId }

        val playerEntries = squadPlayerDetails.map { detail ->
            val player: Player? = playerRepository.findById(detail.id)
            // Only count performances from matches played on/after the player's
            // joinedAt — and never before the squad's mid-season lock timestamp,
            // since those points are already in lockedPoints.
            val cutoff = maxOf(detail.joinedAt, snapshotLockedAt ?: 0L)
            val playerPerfs = seasonPerformancesByPlayer[detail.id].orEmpty()
                .filter { (matchDateById[it.matchId] ?: 0L) >= cutoff }
            FantasySquadPlayerEntry(
                playerId      = detail.id,
                playerName    = detail.name,
                specialism    = player?.specialism ?: "UNKNOWN",
                iplTeam       = player?.iplTeam ?: "",
                soldPrice     = detail.soldPrice,
                totalPoints   = playerPerfs.sumOf { fantasyPointsCalculator.calculate(it) },
                matchesPlayed = playerPerfs.size,
                joinedAt      = detail.joinedAt
            )
        }.sortedByDescending { it.totalPoints }

        val newPoints = playerEntries.sumOf { it.totalPoints }
        return FantasySquadResponse(
            squadId     = squadId,
            squadName   = squad.name,
            auctionId   = squad.auctionId,
            totalPoints = lockedPoints + newPoints,
            lockedPoints = lockedPoints,
            newPoints   = newPoints,
            players     = playerEntries
        )
    }

    // ── Player match-by-match (IPL 2026 current season only) ─────────────────
    // Used by the live fantasy competition view — shows only the current season.
    fun getPlayerFantasy(playerId: String): FantasyPlayerResponse? {
        val player: Player = playerRepository.findById(playerId) ?: return null

        val season2025MatchIds = iplMatchRepository.findAll()
            .filter { it.season == null || it.season == "2025" }
            .map { it.id }.toSet()

        val season2026MatchIds = iplMatchRepository.findBySeason("2026").map { it.id }.toSet()

        val allPerformances = performanceRepository.findByPlayerId(playerId)

        fun List<com.example.ipl_backend.model.PlayerMatchPerformance>.toMatchEntries(matchIds: Set<String>) =
            this.filter { it.matchId in matchIds }.mapNotNull { perf ->
                val match = iplMatchRepository.findById(perf.matchId) ?: return@mapNotNull null
                val bd = fantasyPointsCalculator.breakdown(perf)
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
                    dotBalls        = perf.dotBalls,
                    catches         = perf.catches,
                    stumpings       = perf.stumpings,
                    runOutsDirect   = perf.runOutsDirect,
                    runOutsIndirect = perf.runOutsIndirect,
                    // Use calculator total so headline points always match XI + batting + bowling + fielding.
                    // Stored perf.fantasyPoints can drift if stats were edited without recalculating.
                    fantasyPoints   = bd.total,
                    pointBreakdown  = FantasyPointBreakdown(
                        playingXi = bd.playingXi,
                        batting   = bd.batting,
                        bowling   = bd.bowling,
                        fielding  = bd.fielding
                    )
                )
            }.sortedBy { it.matchDate }

        val matches2025 = allPerformances.toMatchEntries(season2025MatchIds)
        val matches2026 = allPerformances.toMatchEntries(season2026MatchIds)

        return FantasyPlayerResponse(
            playerId      = playerId,
            playerName    = player.name,
            iplTeam       = player.iplTeam ?: "",
            specialism    = player.specialism ?: "UNKNOWN",
            totalPoints   = matches2026.sumOf { it.fantasyPoints },
            matchesPlayed = matches2026.size,
            matches2025   = matches2025,
            matches2026   = matches2026
        )
    }

    // ── Previous squad (pre-reauction snapshot) ───────────────────────────────

    fun getSquadPreviousSquad(squadId: String): FantasySquadPreviousSquadResponse? {
        val squad = squadRepository.findById(squadId) ?: return null
        val snapshot = midSeasonRepository.findSnapshot(squad.auctionId, squadId) ?: return null
        val snapshotPlayers = midSeasonRepository.findSnapshotPlayers(squad.auctionId, squadId)
        val playerEntries = snapshotPlayers.map { sp ->
            FantasySquadPlayerEntry(
                playerId      = sp.playerId,
                playerName    = sp.playerName,
                specialism    = sp.specialism ?: "UNKNOWN",
                iplTeam       = sp.iplTeam ?: "",
                soldPrice     = sp.soldPrice ?: java.math.BigDecimal.ZERO,
                totalPoints   = sp.points,
                matchesPlayed = 0,
                joinedAt      = sp.joinedAt
            )
        }
        return FantasySquadPreviousSquadResponse(
            squadId      = squadId,
            squadName    = squad.name,
            auctionId    = squad.auctionId,
            lockedPoints = snapshot.lockedPoints,
            players      = playerEntries
        )
    }

    // ── Per-match squad attribution ──────────────────────────────────────────
    //
    // Returns playerId → squadName for the given (auctionId, matchId), based on
    // who actually owned the player when the match was played. If the match
    // pre-dates the auction's mid-season lock, the snapshot composition is
    // used; otherwise the current squad is used (with each player's joinedAt
    // honoured so brand-new acquisitions don't get retroactively credited).
    fun getMatchSquadMapping(auctionId: String, matchId: String): Map<String, String>? {
        val auction = auctionRepository.findById(auctionId) ?: return null
        val match = iplMatchRepository.findById(matchId) ?: return null
        val matchDate = match.matchDate
        val lockedAt = auction.pointsLockedAt
        val squads = squadRepository.findByAuction(auctionId)

        val usePreLock = lockedAt != null && matchDate < lockedAt
        val mapping = mutableMapOf<String, String>()

        if (usePreLock) {
            // Pre-mid-season: use snapshot players for each squad.
            for (squad in squads) {
                val snapshotPlayers = midSeasonRepository.findSnapshotPlayers(auctionId, squad.id)
                for (sp in snapshotPlayers) {
                    if (sp.joinedAt <= matchDate) {
                        mapping[sp.playerId] = squad.name
                    }
                }
            }
        } else {
            // Post-lock (or no mid-season): use current squad composition.
            for (squad in squads) {
                val playerDetails = squadRepository.getSquadPlayersBySquadId(squad.id)
                for (detail in playerDetails) {
                    if (detail.joinedAt <= matchDate) {
                        mapping[detail.id] = squad.name
                    }
                }
            }
        }
        return mapping
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
                dotBalls        = perf.dotBalls,
                lbwBowledCount  = perf.lbwBowledCount,
                oversBowled     = perf.oversBowled,
                runsGiven       = perf.runsGiven,
                maidens         = perf.maidens,
                catches         = perf.catches,
                stumpings       = perf.stumpings,
                runOutsDirect   = perf.runOutsDirect,
                runOutsIndirect = perf.runOutsIndirect,
                fantasyPoints   = fantasyPointsCalculator.calculate(perf)
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
        val fantasyPoints  = performances.sumOf { fantasyPointsCalculator.calculate(it) }

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

    private fun resolveSeasonMatches(season: String): List<com.example.ipl_backend.model.IplMatch> {
        val normalized = season.trim()
        return if (normalized == "2025") {
            iplMatchRepository.findAll().filter { it.season == null || it.season == "2025" }
        } else {
            iplMatchRepository.findBySeason(normalized)
        }
    }

    private fun resolveSeasonMatchIds(season: String): Set<String> =
        resolveSeasonMatches(season).map { it.id }.toSet()
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