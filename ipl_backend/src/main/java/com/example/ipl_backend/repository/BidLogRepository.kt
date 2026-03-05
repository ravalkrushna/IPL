package com.example.ipl_backend.repository

import com.example.ipl_backend.model.*
import org.jetbrains.exposed.dao.id.EntityID
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction
import org.springframework.stereotype.Repository
import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

@Repository
class BidLogRepository {

    private fun ResultRow.toLog(): BidLog =
        BidLog(
            id              = this[BidLogs.id].value,
            auctionId       = this[BidLogs.auctionId],
            playerId        = this[BidLogs.playerId],
            participantId   = this[BidLogs.participantId],
            participantName = this[BidLogs.participantName],
            squadName       = this[BidLogs.squadName],
            amount          = this[BidLogs.amount],
            bidType         = this[BidLogs.bidType],
            createdAt       = this[BidLogs.createdAt]
        )

    fun save(
        auctionId: String,
        playerId: String?,
        participantId: UUID? = null,
        participantName: String? = null,
        squadName: String? = null,
        amount: BigDecimal? = null,
        bidType: BidType
    ) {
        transaction {
            BidLogs.insert {
                it[BidLogs.id]              = UUID.randomUUID()
                it[BidLogs.auctionId]       = auctionId
                it[BidLogs.playerId]        = playerId
                it[BidLogs.participantId]   = participantId
                it[BidLogs.participantName] = participantName
                it[BidLogs.squadName]       = squadName
                it[BidLogs.amount]          = amount
                it[BidLogs.bidType]         = bidType
                it[BidLogs.createdAt]       = Instant.now().toEpochMilli()
            }
        }
    }

    fun findByAuction(auctionId: String): List<BidLog> =
        transaction {
            BidLogs.selectAll()
                .where { BidLogs.auctionId eq auctionId }
                .orderBy(BidLogs.createdAt to SortOrder.DESC)
                .map { it.toLog() }
        }

    fun findByPlayer(auctionId: String, playerId: String): List<BidLog> =
        transaction {
            BidLogs.selectAll()
                .where {
                    (BidLogs.auctionId eq auctionId) and
                            (BidLogs.playerId eq playerId)
                }
                .orderBy(BidLogs.createdAt to SortOrder.ASC)
                .map { it.toLog() }
        }

    fun findAll(): List<BidLog> =
        transaction {
            BidLogs.selectAll()
                .orderBy(BidLogs.createdAt to SortOrder.DESC)
                .map { it.toLog() }
        }

    fun delete(id: UUID) {
        transaction {
            BidLogs.deleteWhere { BidLogs.id eq EntityID(id, BidLogs) }
        }
    }
}