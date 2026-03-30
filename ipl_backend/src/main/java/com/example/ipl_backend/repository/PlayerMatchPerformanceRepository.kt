package com.example.ipl_backend.repository

import com.example.ipl_backend.model.IplMatches
import com.example.ipl_backend.model.PlayerMatchPerformance
import com.example.ipl_backend.model.PlayerMatchPerformances
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.inList
import org.jetbrains.exposed.sql.transactions.transaction
import org.springframework.stereotype.Repository

@Repository
class PlayerMatchPerformanceRepository {

    private fun ResultRow.toPerformance(): PlayerMatchPerformance =
        PlayerMatchPerformance(
            id              = this[PlayerMatchPerformances.id],
            playerId        = this[PlayerMatchPerformances.playerId],
            matchId         = this[PlayerMatchPerformances.matchId],
            runs            = this[PlayerMatchPerformances.runs],
            ballsFaced      = this[PlayerMatchPerformances.ballsFaced],
            fours           = this[PlayerMatchPerformances.fours],
            sixes           = this[PlayerMatchPerformances.sixes],
            dismissed       = this[PlayerMatchPerformances.dismissed],
            wickets         = this[PlayerMatchPerformances.wickets],
            lbwBowledCount  = this[PlayerMatchPerformances.lbwBowledCount],
            oversBowled     = this[PlayerMatchPerformances.oversBowled],
            runsGiven       = this[PlayerMatchPerformances.runsGiven],
            maidens         = this[PlayerMatchPerformances.maidens],
            catches         = this[PlayerMatchPerformances.catches],
            stumpings       = this[PlayerMatchPerformances.stumpings],
            runOutsDirect   = this[PlayerMatchPerformances.runOutsDirect],
            runOutsIndirect = this[PlayerMatchPerformances.runOutsIndirect],
            playingXi       = this[PlayerMatchPerformances.playingXi],
            fantasyPoints   = this[PlayerMatchPerformances.fantasyPoints],
            createdAt       = this[PlayerMatchPerformances.createdAt]
        )

    fun save(performance: PlayerMatchPerformance) {
        transaction {
            PlayerMatchPerformances.insert {
                it[id]              = performance.id
                it[playerId]        = performance.playerId
                it[matchId]         = performance.matchId
                it[runs]            = performance.runs
                it[ballsFaced]      = performance.ballsFaced
                it[fours]           = performance.fours
                it[sixes]           = performance.sixes
                it[dismissed]       = performance.dismissed
                it[wickets]         = performance.wickets
                it[lbwBowledCount]  = performance.lbwBowledCount
                it[oversBowled]     = performance.oversBowled
                it[runsGiven]       = performance.runsGiven
                it[maidens]         = performance.maidens
                it[catches]         = performance.catches
                it[stumpings]       = performance.stumpings
                it[runOutsDirect]   = performance.runOutsDirect
                it[runOutsIndirect] = performance.runOutsIndirect
                it[playingXi]       = performance.playingXi
                it[fantasyPoints]   = performance.fantasyPoints
                it[createdAt]       = performance.createdAt
            }
        }
    }

    // Upsert — update if exists, insert if not
    // Used by cron job so re-running is safe
    fun upsert(performance: PlayerMatchPerformance) {
        transaction {
            val existing = PlayerMatchPerformances.selectAll()
                .where {
                    (PlayerMatchPerformances.playerId eq performance.playerId) and
                            (PlayerMatchPerformances.matchId eq performance.matchId)
                }
                .singleOrNull()

            if (existing != null) {
                PlayerMatchPerformances.update({
                    (PlayerMatchPerformances.playerId eq performance.playerId) and
                            (PlayerMatchPerformances.matchId eq performance.matchId)
                }) {
                    it[runs]            = performance.runs
                    it[ballsFaced]      = performance.ballsFaced
                    it[fours]           = performance.fours
                    it[sixes]           = performance.sixes
                    it[dismissed]       = performance.dismissed
                    it[wickets]         = performance.wickets
                    it[lbwBowledCount]  = performance.lbwBowledCount
                    it[oversBowled]     = performance.oversBowled
                    it[runsGiven]       = performance.runsGiven
                    it[maidens]         = performance.maidens
                    it[catches]         = performance.catches
                    it[stumpings]       = performance.stumpings
                    it[runOutsDirect]   = performance.runOutsDirect
                    it[runOutsIndirect] = performance.runOutsIndirect
                    it[playingXi]       = performance.playingXi
                    it[fantasyPoints]   = performance.fantasyPoints
                }
            } else {
                save(performance)
            }
        }
    }

    fun findByMatchId(matchId: String): List<PlayerMatchPerformance> =
        transaction {
            PlayerMatchPerformances.selectAll()
                .where { PlayerMatchPerformances.matchId eq matchId }
                .map { it.toPerformance() }
        }

    fun findByPlayerId(playerId: String): List<PlayerMatchPerformance> =
        transaction {
            PlayerMatchPerformances.selectAll()
                .where { PlayerMatchPerformances.playerId eq playerId }
                .orderBy(PlayerMatchPerformances.createdAt to SortOrder.DESC)
                .map { it.toPerformance() }
        }

    fun findAllPerformances(): List<PlayerMatchPerformance> =
        transaction {
            PlayerMatchPerformances.selectAll()
                .orderBy(PlayerMatchPerformances.createdAt to SortOrder.ASC)
                .map { it.toPerformance() }
        }

    /** Performances whose match row has the given season (e.g. "2026"). */
    fun findAllPerformancesForSeason(season: String): List<PlayerMatchPerformance> =
        transaction {
            (PlayerMatchPerformances innerJoin IplMatches)
                .selectAll()
                .where { IplMatches.season eq season }
                .orderBy(PlayerMatchPerformances.createdAt to SortOrder.ASC)
                .map { it.toPerformance() }
        }

    fun existsByPlayerIdAndMatchLabel(playerId: String, matchLabel: String): Boolean =
        transaction {
            PlayerMatchPerformances.selectAll()
                .where {
                    (PlayerMatchPerformances.playerId eq playerId) and
                    (PlayerMatchPerformances.matchId eq matchLabel)
                }
                .count() > 0
        }

    fun findByPlayerIds(playerIds: List<String>): List<PlayerMatchPerformance> =
        transaction {
            if (playerIds.isEmpty()) return@transaction emptyList()
            PlayerMatchPerformances.selectAll()
                .where { PlayerMatchPerformances.playerId inList playerIds }
                .map { it.toPerformance() }
        }

    fun findByMatchIds(matchIds: Collection<String>): List<PlayerMatchPerformance> =
        transaction {
            if (matchIds.isEmpty()) return@transaction emptyList()
            PlayerMatchPerformances.selectAll()
                .where { PlayerMatchPerformances.matchId inList matchIds }
                .map { it.toPerformance() }
        }

    // Deletes all performance rows for the given match IDs.
    // Must be called before deleting the corresponding ipl_matches rows (FK order).
    fun deleteByMatchIds(matchIds: List<String>): Int =
        transaction {
            if (matchIds.isEmpty()) return@transaction 0
            PlayerMatchPerformances.deleteWhere { matchId inList matchIds }
        }

}