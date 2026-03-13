package com.example.ipl_backend.service

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
        val IST = ZoneId.of("Asia/Kolkata")
    }

    // ── Fantasy points sheet ──────────────────────────────────────────────────

    fun syncToSheet() {
        val allPlayers = playerRepository.findAll()

        val season2026MatchIds = matchRepository.findBySeason("2026").map { it.id }.toSet()
        val allPerfs = performanceRepository.findAllPerformances()
            .filter { it.matchId in season2026MatchIds }

        val totalsByPlayerId = allPerfs.groupBy { it.playerId }
            .mapValues { (_, performances) -> performances.sumOf { it.fantasyPoints } }

        val teamNameByPlayerId = fetchTeamNameByPlayerId()
        val perfsByPlayerId    = allPerfs.groupBy { it.playerId }

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
        log.info("Fantasy Points sheet synced — ${dataRows.size} players, ${matchLabels.size} matches")
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

    private fun extractMatchNumber(matchId: String): Int =
        Regex("(\\d+)").findAll(matchId).lastOrNull()?.value?.toIntOrNull() ?: 999
}