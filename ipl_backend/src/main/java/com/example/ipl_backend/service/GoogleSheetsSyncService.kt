package com.example.ipl_backend.service

import com.example.ipl_backend.model.AuctionStatus
import com.example.ipl_backend.model.Auctions
import com.example.ipl_backend.model.Players
import com.example.ipl_backend.repository.IplMatchRepository
import com.example.ipl_backend.repository.PlayerMatchPerformanceRepository
import com.example.ipl_backend.repository.PlayerRepository
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
    private val sheetsService: GoogleSheetsService
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

        // Team Total is based on your auction squads (Squads.name), not on IPL team code (MI/CSK/etc.).
        // We use the same mapping that powers "Auction Team" in the auction tabs.
        val totalsBySquad = mutableMapOf<String, Int>()
        for ((playerId, squadName) in teamNameByPlayerId) {
            if (squadName.isBlank()) continue
            val pts = totalsByPlayerId[playerId] ?: 0
            totalsBySquad[squadName] = (totalsBySquad[squadName] ?: 0) + pts
        }

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