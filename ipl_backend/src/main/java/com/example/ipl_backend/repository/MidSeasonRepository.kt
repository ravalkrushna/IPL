package com.example.ipl_backend.repository

import com.example.ipl_backend.model.*
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction
import org.springframework.stereotype.Repository
import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

@Repository
class MidSeasonRepository {

    // ── Retentions ────────────────────────────────────────────────────────────

    private fun ResultRow.toRetention() = MidSeasonRetention(
        id             = this[MidSeasonRetentions.id],
        auctionId      = this[MidSeasonRetentions.auctionId],
        squadId        = this[MidSeasonRetentions.squadId],
        playerId       = this[MidSeasonRetentions.playerId],
        playerName     = this.getOrNull(Players.name) ?: "",
        retentionOrder = this[MidSeasonRetentions.retentionOrder],
        retentionCost  = this[MidSeasonRetentions.retentionCost],
        createdAt      = this[MidSeasonRetentions.createdAt]
    )

    private val retentionWithPlayer get() =
        MidSeasonRetentions.join(Players, JoinType.LEFT, MidSeasonRetentions.playerId, Players.id)

    fun findRetentionsByAuction(auctionId: String): List<MidSeasonRetention> =
        transaction {
            retentionWithPlayer.selectAll()
                .where { MidSeasonRetentions.auctionId eq auctionId }
                .orderBy(MidSeasonRetentions.squadId to SortOrder.ASC, MidSeasonRetentions.retentionOrder to SortOrder.ASC)
                .map { it.toRetention() }
        }

    fun findRetentionsBySquad(auctionId: String, squadId: String): List<MidSeasonRetention> =
        transaction {
            retentionWithPlayer.selectAll()
                .where { (MidSeasonRetentions.auctionId eq auctionId) and (MidSeasonRetentions.squadId eq squadId) }
                .orderBy(MidSeasonRetentions.retentionOrder to SortOrder.ASC)
                .map { it.toRetention() }
        }

    fun countRetentionsForSquad(auctionId: String, squadId: String): Int =
        transaction {
            MidSeasonRetentions.selectAll()
                .where { (MidSeasonRetentions.auctionId eq auctionId) and (MidSeasonRetentions.squadId eq squadId) }
                .count().toInt()
        }

    fun playerAlreadyRetained(auctionId: String, squadId: String, playerId: String): Boolean =
        transaction {
            MidSeasonRetentions.selectAll()
                .where {
                    (MidSeasonRetentions.auctionId eq auctionId) and
                    (MidSeasonRetentions.squadId eq squadId) and
                    (MidSeasonRetentions.playerId eq playerId)
                }
                .count() > 0
        }

    fun addRetention(auctionId: String, squadId: String, playerId: String): MidSeasonRetention {
        val order = countRetentionsForSquad(auctionId, squadId) + 1
        val cost = RETENTION_COSTS[order]
            ?: throw IllegalStateException("Max 4 retentions allowed per squad")
        val now = Instant.now().toEpochMilli()
        val id = UUID.randomUUID().toString()
        val playerName = transaction {
            Players.selectAll().where { Players.id eq playerId }.map { it[Players.name] }.singleOrNull() ?: ""
        }
        transaction {
            MidSeasonRetentions.insert {
                it[MidSeasonRetentions.id]             = id
                it[MidSeasonRetentions.auctionId]      = auctionId
                it[MidSeasonRetentions.squadId]        = squadId
                it[MidSeasonRetentions.playerId]       = playerId
                it[MidSeasonRetentions.retentionOrder] = order
                it[MidSeasonRetentions.retentionCost]  = cost
                it[MidSeasonRetentions.createdAt]      = now
            }
        }
        return MidSeasonRetention(id, auctionId, squadId, playerId, playerName, order, cost, now)
    }

    fun removeRetention(auctionId: String, squadId: String, playerId: String) {
        transaction {
            MidSeasonRetentions.deleteWhere {
                (MidSeasonRetentions.auctionId eq auctionId) and
                (MidSeasonRetentions.squadId eq squadId) and
                (MidSeasonRetentions.playerId eq playerId)
            }
            // Renumber remaining retentions in order
            val remaining = MidSeasonRetentions.selectAll()
                .where { (MidSeasonRetentions.auctionId eq auctionId) and (MidSeasonRetentions.squadId eq squadId) }
                .orderBy(MidSeasonRetentions.retentionOrder to SortOrder.ASC)
                .map { it[MidSeasonRetentions.id] }

            remaining.forEachIndexed { index, retentionId ->
                val newOrder = index + 1
                val newCost = RETENTION_COSTS[newOrder]!!
                MidSeasonRetentions.update({ MidSeasonRetentions.id eq retentionId }) {
                    it[MidSeasonRetentions.retentionOrder] = newOrder
                    it[MidSeasonRetentions.retentionCost]  = newCost
                }
            }
        }
    }

    // ── Score snapshots ───────────────────────────────────────────────────────

    private fun ResultRow.toSnapshot() = SquadScoreSnapshot(
        id           = this[SquadScoreSnapshots.id],
        auctionId    = this[SquadScoreSnapshots.auctionId],
        squadId      = this[SquadScoreSnapshots.squadId],
        lockedPoints = this[SquadScoreSnapshots.lockedPoints],
        lockedAt     = this[SquadScoreSnapshots.lockedAt]
    )

    fun saveSnapshot(auctionId: String, squadId: String, lockedPoints: Int, lockedAt: Long) {
        transaction {
            val existing = SquadScoreSnapshots.selectAll()
                .where { (SquadScoreSnapshots.auctionId eq auctionId) and (SquadScoreSnapshots.squadId eq squadId) }
                .count()
            if (existing > 0) {
                SquadScoreSnapshots.update({
                    (SquadScoreSnapshots.auctionId eq auctionId) and (SquadScoreSnapshots.squadId eq squadId)
                }) {
                    it[SquadScoreSnapshots.lockedPoints] = lockedPoints
                    it[SquadScoreSnapshots.lockedAt]     = lockedAt
                }
            } else {
                SquadScoreSnapshots.insert {
                    it[SquadScoreSnapshots.id]           = UUID.randomUUID().toString()
                    it[SquadScoreSnapshots.auctionId]    = auctionId
                    it[SquadScoreSnapshots.squadId]      = squadId
                    it[SquadScoreSnapshots.lockedPoints] = lockedPoints
                    it[SquadScoreSnapshots.lockedAt]     = lockedAt
                }
            }
        }
    }

    fun findSnapshot(auctionId: String, squadId: String): SquadScoreSnapshot? =
        transaction {
            SquadScoreSnapshots.selectAll()
                .where { (SquadScoreSnapshots.auctionId eq auctionId) and (SquadScoreSnapshots.squadId eq squadId) }
                .map { it.toSnapshot() }
                .singleOrNull()
        }

    fun findAllSnapshots(auctionId: String): List<SquadScoreSnapshot> =
        transaction {
            SquadScoreSnapshots.selectAll()
                .where { SquadScoreSnapshots.auctionId eq auctionId }
                .map { it.toSnapshot() }
        }

    // ── Snapshot players (per-player breakdown at lock time) ──────────────────

    private fun ResultRow.toSnapshotPlayer() = SquadSnapshotPlayer(
        id          = this[SquadSnapshotPlayers.id],
        auctionId   = this[SquadSnapshotPlayers.auctionId],
        squadId     = this[SquadSnapshotPlayers.squadId],
        playerId    = this[SquadSnapshotPlayers.playerId],
        playerName  = this[SquadSnapshotPlayers.playerName],
        specialism  = this[SquadSnapshotPlayers.specialism],
        iplTeam     = this[SquadSnapshotPlayers.iplTeam],
        soldPrice   = this[SquadSnapshotPlayers.soldPrice],
        points      = this[SquadSnapshotPlayers.points],
        joinedAt    = this[SquadSnapshotPlayers.joinedAt]
    )

    fun saveSnapshotPlayer(
        auctionId: String,
        squadId: String,
        playerId: String,
        playerName: String,
        specialism: String?,
        iplTeam: String?,
        soldPrice: BigDecimal?,
        points: Int,
        joinedAt: Long
    ) {
        transaction {
            val existing = SquadSnapshotPlayers.selectAll()
                .where {
                    (SquadSnapshotPlayers.auctionId eq auctionId) and
                    (SquadSnapshotPlayers.squadId eq squadId) and
                    (SquadSnapshotPlayers.playerId eq playerId)
                }.count()
            if (existing > 0) {
                SquadSnapshotPlayers.update({
                    (SquadSnapshotPlayers.auctionId eq auctionId) and
                    (SquadSnapshotPlayers.squadId eq squadId) and
                    (SquadSnapshotPlayers.playerId eq playerId)
                }) {
                    it[SquadSnapshotPlayers.points] = points
                }
            } else {
                SquadSnapshotPlayers.insert {
                    it[SquadSnapshotPlayers.id]         = UUID.randomUUID().toString()
                    it[SquadSnapshotPlayers.auctionId]  = auctionId
                    it[SquadSnapshotPlayers.squadId]    = squadId
                    it[SquadSnapshotPlayers.playerId]   = playerId
                    it[SquadSnapshotPlayers.playerName] = playerName
                    it[SquadSnapshotPlayers.specialism] = specialism
                    it[SquadSnapshotPlayers.iplTeam]    = iplTeam
                    it[SquadSnapshotPlayers.soldPrice]  = soldPrice
                    it[SquadSnapshotPlayers.points]     = points
                    it[SquadSnapshotPlayers.joinedAt]   = joinedAt
                }
            }
        }
    }

    fun findSnapshotPlayers(auctionId: String, squadId: String): List<SquadSnapshotPlayer> =
        transaction {
            SquadSnapshotPlayers.selectAll()
                .where {
                    (SquadSnapshotPlayers.auctionId eq auctionId) and
                    (SquadSnapshotPlayers.squadId eq squadId)
                }
                .orderBy(SquadSnapshotPlayers.points to SortOrder.DESC)
                .map { it.toSnapshotPlayer() }
        }
}
