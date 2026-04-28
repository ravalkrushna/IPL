package com.example.ipl_backend.service

import com.example.ipl_backend.model.AuctionStatus
import com.example.ipl_backend.model.Auctions
import com.example.ipl_backend.model.MidSeasonPhase
import com.example.ipl_backend.model.Players
import com.example.ipl_backend.repository.IplMatchRepository
import com.example.ipl_backend.repository.MidSeasonRepository
import com.example.ipl_backend.repository.PlayerMatchPerformanceRepository
import com.example.ipl_backend.repository.PlayerRepository
import com.example.ipl_backend.repository.SquadRepository
import com.example.ipl_backend.repository.UpcomingMatchRepository
import com.example.ipl_backend.model.SquadPlayers
import com.example.ipl_backend.model.Squads
import org.jetbrains.exposed.sql.innerJoin
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.transaction
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

@Service
class GoogleSheetsSyncService(
    private val playerRepository: PlayerRepository,
    private val performanceRepository: PlayerMatchPerformanceRepository,
    private val matchRepository: IplMatchRepository,
    private val upcomingMatchRepository: UpcomingMatchRepository,
    private val sheetsService: GoogleSheetsService,
    private val midSeasonRepository: MidSeasonRepository,
    private val squadRepository: SquadRepository
) {

    private val log = LoggerFactory.getLogger(javaClass)

    companion object {
        const val FIXTURES_TAB = "IPL 2026 Fixtures"
        const val POINTS_TAB   = "Fantasy Points"
        const val TEAM_TOTAL_TAB = "Team Total"
        val IST = ZoneId.of("Asia/Kolkata")
        private const val FANTASY_SEASON = "2026"
    }

    data class FantasySheetSyncResult(
        val performancesUsed: Int,
        val matchColumns: Int,
        val playerRowsWritten: Int,
        val ipl2026MatchesInDb: Int
    )

    // ── Fantasy points sheet ──────────────────────────────────────────────────

    fun syncToSheet(): FantasySheetSyncResult {
        val allPlayers = playerRepository.findAll()

        val matchesInDb = matchRepository.findBySeason(FANTASY_SEASON)
        val allPerfs    = performanceRepository.findAllPerformancesForSeason(FANTASY_SEASON)

        if (allPerfs.isEmpty()) {
            log.warn(
                "No player_match_performances linked to ipl_matches.season='{}'. " +
                    "Check: (1) cron/sync-now saved rows, (2) ipl_matches.season is '{}' for those fixtures.",
                FANTASY_SEASON,
                FANTASY_SEASON
            )
        }

        val totalsByPlayerId = allPerfs.groupBy { it.playerId }
            .mapValues { (_, performances) -> performances.sumOf { it.fantasyPoints } }

        val teamNameByPlayerId = fetchTeamNameByPlayerId()
        val perfsByPlayerId    = allPerfs.groupBy { it.playerId }

        // Team Total = (lockedPoints from mid-season snapshot, if any) + sum over
        // current squad players of fantasy points earned on/after their cutoff
        // (cutoff = max(player.joinedAt, snapshot.lockedAt)). This avoids
        // double-counting pre-lock perfs of retained players (already in
        // lockedPoints) and stops crediting newly-bought players for perfs
        // earned for their previous squad.
        val matchDateById = matchesInDb.associate { it.id to it.matchDate }
        val totalsBySquad = computeSquadTotals(matchDateById, perfsByPlayerId)

        val matchLabels = allPerfs
            .map { it.matchId }
            .distinct()
            .sortedWith(compareBy { extractMatchNumber(it) })

        val header = mutableListOf<Any>("name", "iplTeam", "teamName", "IPL 2026 Total")
        header.addAll(matchLabels.map { labelFor(it) })

        val dataRows = allPlayers
            .filter { player ->
                perfsByPlayerId.containsKey(player.id) || teamNameByPlayerId.containsKey(player.id)
            }
            .sortedBy { it.name }
            .map { player ->
                val row = mutableListOf<Any>()
                row.add(player.name)
                row.add(player.iplTeam ?: "")
                row.add(teamNameByPlayerId[player.id] ?: "")
                row.add(totalsByPlayerId[player.id] ?: 0)

                val matchPerfs = perfsByPlayerId[player.id]?.associateBy { it.matchId } ?: emptyMap()
                matchLabels.forEach { id -> row.add(matchPerfs[id]?.fantasyPoints ?: "") }

                row as List<Any>
            }

        sheetsService.writeToTab(POINTS_TAB, listOf(header) + dataRows)
        log.info(
            "Fantasy Points sheet synced — {} players, {} match columns, {} perf rows ({} IPL {} matches in DB)",
            dataRows.size,
            matchLabels.size,
            allPerfs.size,
            matchesInDb.size,
            FANTASY_SEASON
        )

        // ── Team Total sheet ──────────────────────────────────────────────
        // Shows each auction squad's overall total across all players.
        val teamRows = totalsBySquad.entries
            .sortedByDescending { it.value }
            .map { (squadName, total) -> listOf<Any>(squadName, total) }

        sheetsService.writeToTab(
            TEAM_TOTAL_TAB,
            listOf(listOf<Any>("Team", "Team 2026 Total")) + teamRows
        )
        log.info("Team Total sheet synced — {} team rows", teamRows.size)

        return FantasySheetSyncResult(
            performancesUsed     = allPerfs.size,
            matchColumns         = matchLabels.size,
            playerRowsWritten    = dataRows.size,
            ipl2026MatchesInDb   = matchesInDb.size
        )
    }

    // ── Fixtures sheet ────────────────────────────────────────────────────────

    fun syncFixturesToSheet() {
        val matches = upcomingMatchRepository.findBySeason("2026")

        if (matches.isEmpty()) {
            log.warn("No upcoming IPL 2026 fixtures found — run POST /api/v1/fantasy/seed-fixtures first")
            return
        }

        val header = listOf<Any>(
            "Match No", "Date (IST)", "Teams", "Kickoff (IST)", "Status"
        )

        val dataRows = matches.map { m ->
            val (dateStr, timeStr) = formatEpochIst(m.matchDate)
            listOf<Any>(
                "Match ${m.matchNo}",
                dateStr,
                "${m.teamA} vs ${m.teamB}",
                timeStr,
                "⏳ Upcoming"
            )
        }

        sheetsService.writeToTab(FIXTURES_TAB, listOf(header) + dataRows)
        log.info("Fixtures sheet synced — ${matches.size} matches written to '$FIXTURES_TAB'")
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    // ── Mid-season auction tab ────────────────────────────────────────────────
    //
    // For every auction whose mid-season auction has run (snapshot exists), write
    // a separate tab named "$auctionName - Mid Season" that shows the post-auction
    // squad composition with only post-lock match columns and the points each
    // player has earned since the lock. The original auction tab keeps its
    // pre-mid-season state untouched.
    fun syncMidSeasonAuctionTabs() {
        val auctions = transaction {
            Auctions.selectAll()
                .where { Auctions.midSeasonPhase neq MidSeasonPhase.NOT_STARTED }
                .map { Triple(it[Auctions.id], it[Auctions.name], it[Auctions.pointsLockedAt]) }
        }
        if (auctions.isEmpty()) return

        val seasonMatches = matchRepository.findBySeason(FANTASY_SEASON)
        val matchDateById = seasonMatches.associate { it.id to it.matchDate }
        val allPerfs = performanceRepository.findAllPerformancesForSeason(FANTASY_SEASON)
        val perfsByPlayerId = allPerfs.groupBy { it.playerId }

        for ((auctionId, auctionName, _) in auctions) {
            val snapshots = midSeasonRepository.findAllSnapshots(auctionId)
            if (snapshots.isEmpty()) continue
            val lockedAtBySquad = snapshots.associate { it.squadId to it.lockedAt }
            val squads = squadRepository.findByAuction(auctionId)
            if (squads.isEmpty()) continue

            // Per-player rows for the new squad, with per-player cutoff applied.
            data class Row(
                val playerId: String,
                val playerName: String,
                val iplTeam: String,
                val squadName: String,
                val cutoff: Long,
                val total: Int,
                val perfsByMatch: Map<String, Int>
            )

            val rows = mutableListOf<Row>()
            val matchIdsTouched = mutableSetOf<String>()
            for (squad in squads) {
                val lockedAt = lockedAtBySquad[squad.id] ?: continue
                val playerDetails = squadRepository.getSquadPlayersBySquadId(squad.id)
                for (detail in playerDetails) {
                    val cutoff = maxOf(detail.joinedAt, lockedAt)
                    val perfs = perfsByPlayerId[detail.id].orEmpty()
                        .filter { (matchDateById[it.matchId] ?: 0L) >= cutoff }
                    val total = perfs.sumOf { it.fantasyPoints }
                    val perfsByMatch = perfs.associate { it.matchId to it.fantasyPoints }
                    matchIdsTouched += perfsByMatch.keys
                    val player = playerRepository.findById(detail.id)
                    rows += Row(
                        playerId    = detail.id,
                        playerName  = detail.name,
                        iplTeam     = player?.iplTeam ?: "",
                        squadName   = squad.name,
                        cutoff      = cutoff,
                        total       = total,
                        perfsByMatch = perfsByMatch
                    )
                }
            }

            val matchLabels = matchIdsTouched
                .sortedWith(compareBy { extractMatchNumber(it) })

            val header = mutableListOf<Any>("Player", "IPL Team", "Auction Team", "Mid-Season Points")
            header.addAll(matchLabels.map { labelFor(it) })

            val dataRows = rows
                .sortedByDescending { it.total }
                .map { r ->
                    val row = mutableListOf<Any>()
                    row.add(r.playerName)
                    row.add(r.iplTeam)
                    row.add(r.squadName)
                    row.add(r.total)
                    matchLabels.forEach { id -> row.add(r.perfsByMatch[id] ?: "") }
                    row as List<Any>
                }

            val tabName = "$auctionName - Mid Season"
            sheetsService.writeToTab(tabName, listOf(header) + dataRows)
            log.info("Mid-season tab '$tabName' synced — ${dataRows.size} players, ${matchLabels.size} matches")
        }
    }

    // Computes squad totals for the Team Total tab, applying mid-season snapshot
    // cutoffs when present. Squad totals = lockedPoints + post-cutoff perfs of
    // current squad members. Squads with no snapshot fall back to "all perfs of
    // current squad members", preserving pre-mid-season behavior.
    private fun computeSquadTotals(
        matchDateById: Map<String, Long>,
        perfsByPlayerId: Map<String, List<com.example.ipl_backend.model.PlayerMatchPerformance>>
    ): Map<String, Int> {
        val totals = mutableMapOf<String, Int>()
        val auctionIds = transaction {
            Auctions.selectAll().map { it[Auctions.id] }
        }
        for (auctionId in auctionIds) {
            val snapshotsBySquad = midSeasonRepository.findAllSnapshots(auctionId).associateBy { it.squadId }
            val squads = squadRepository.findByAuction(auctionId)
            for (squad in squads) {
                val snapshot = snapshotsBySquad[squad.id]
                val locked = snapshot?.lockedPoints ?: 0
                val lockedAt = snapshot?.lockedAt ?: 0L
                val playerDetails = squadRepository.getSquadPlayersBySquadId(squad.id)
                var earned = 0
                for (detail in playerDetails) {
                    val cutoff = maxOf(detail.joinedAt, lockedAt)
                    earned += perfsByPlayerId[detail.id].orEmpty()
                        .filter { (matchDateById[it.matchId] ?: 0L) >= cutoff }
                        .sumOf { it.fantasyPoints }
                }
                totals[squad.name] = (totals[squad.name] ?: 0) + locked + earned
            }
        }
        return totals
    }

    private fun fetchTeamNameByPlayerId(): Map<String, String> =
        transaction {
            (SquadPlayers innerJoin Squads)
                .selectAll()
                .associate { it[SquadPlayers.playerId] to it[Squads.name] }
        }

    private fun labelFor(matchId: String): String {
        val match = matchRepository.findById(matchId)
        return if (match != null)
            "M${match.matchNo} ${match.teamA} vs ${match.teamB}"
        else
            matchId
    }

    private fun formatEpochIst(epochMs: Long): Pair<String, String> {
        val zdt  = Instant.ofEpochMilli(epochMs).atZone(IST)
        val date = zdt.format(DateTimeFormatter.ofPattern("EEE, dd MMM yyyy", Locale.ENGLISH))
        val time = zdt.format(DateTimeFormatter.ofPattern("hh:mm a", Locale.ENGLISH))
        return Pair(date, time)
    }

    fun syncAuctionTabs() {
        // Get all auctions
        val auctions = transaction {
            Auctions.selectAll()
                .where { Auctions.status eq AuctionStatus.COMPLETED }
                .map { Pair(it[Auctions.id], it[Auctions.name]) }
        }

        for ((auctionId, auctionName) in auctions) {
            // Get all squads for this auction
            val squads = transaction {
                Squads.selectAll()
                    .where { Squads.auctionId eq auctionId }
                    .associate { it[Squads.id] to it[Squads.name] }
            }

            if (squads.isEmpty()) continue

            // Get all sold players in this auction with their squad name and purchase price
            val soldPlayers = transaction {
                (SquadPlayers innerJoin Squads innerJoin Players)
                    .selectAll()
                    .where { Squads.auctionId eq auctionId }
                    .map { row ->
                        Triple(
                            row[Players.id],
                            row[Players.name],
                            row[Squads.name]   // squad/team name
                        )
                    }
            }

            if (soldPlayers.isEmpty()) continue

            val soldPlayerIds = soldPlayers.map { it.first }.toSet()
            val allPerfs = performanceRepository.findAllPerformancesForSeason(FANTASY_SEASON)
                .filter { it.playerId in soldPlayerIds }

            val perfsByPlayerId = allPerfs.groupBy { it.playerId }
            val totalsByPlayerId = allPerfs.groupBy { it.playerId }
                .mapValues { (_, perfs) -> perfs.sumOf { it.fantasyPoints } }

            val matchLabels = allPerfs
                .map { it.matchId }
                .distinct()
                .sortedWith(compareBy { extractMatchNumber(it) })

            // Build header
            val header = mutableListOf<Any>("Player", "IPL Team", "Auction Team", "Total Points")
            header.addAll(matchLabels.map { labelFor(it) })

            // Build rows — one per sold player
            val dataRows = soldPlayers
                .sortedByDescending { totalsByPlayerId[it.first] ?: 0 }
                .map { (playerId, playerName, squadName) ->
                    val player = playerRepository.findById(playerId)
                    val row = mutableListOf<Any>()
                    row.add(playerName)
                    row.add(player?.iplTeam ?: "")
                    row.add(squadName)
                    row.add(totalsByPlayerId[playerId] ?: 0)

                    val matchPerfs = perfsByPlayerId[playerId]?.associateBy { it.matchId } ?: emptyMap()
                    matchLabels.forEach { id -> row.add(matchPerfs[id]?.fantasyPoints ?: "") }

                    row as List<Any>
                }

            sheetsService.writeToTab(auctionName, listOf(header) + dataRows)
            log.info("Auction tab '$auctionName' synced — ${dataRows.size} players")
        }
    }

    private fun extractMatchNumber(matchId: String): Int =
        Regex("(\\d+)").findAll(matchId).lastOrNull()?.value?.toIntOrNull() ?: 999
}