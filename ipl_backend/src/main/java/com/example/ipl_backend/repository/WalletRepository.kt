package com.example.ipl_backend.repository

import com.example.ipl_backend.dto.WalletLeaderboardResponse
import com.example.ipl_backend.model.Wallet
import com.example.ipl_backend.model.Wallets
import com.example.ipl_backend.model.Participants
import org.jetbrains.exposed.dao.id.EntityID
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.minus
import org.jetbrains.exposed.sql.SqlExpressionBuilder.plus
import org.jetbrains.exposed.sql.transactions.transaction
import org.springframework.stereotype.Repository
import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

// 100 Crore = 1,00,00,00,000
private val STARTING_BALANCE = BigDecimal("1000000000.00")

@Repository
class WalletRepository {

    private fun ResultRow.toWallet(): Wallet =
        Wallet(
            id            = this[Wallets.id].value,
            participantId = this[Wallets.participantId].value,
            auctionId     = this[Wallets.auctionId],
            balance       = this[Wallets.balance],
            createdAt     = this[Wallets.createdAt],
            updatedAt     = this[Wallets.updatedAt]
        )

    /** Called when auction is created — creates 100CR wallet for every participant. */
    fun createForAllParticipants(auctionId: String, participantIds: List<UUID>) {
        val now = Instant.now().toEpochMilli()
        transaction {
            participantIds.forEach { participantId ->
                val alreadyExists = Wallets.selectAll()
                    .where {
                        (Wallets.participantId eq EntityID(participantId, Participants)) and
                                (Wallets.auctionId eq auctionId)
                    }.count() > 0

                if (!alreadyExists) {
                    Wallets.insert {
                        it[id]                    = UUID.randomUUID()
                        it[Wallets.participantId] = EntityID(participantId, Participants)
                        it[Wallets.auctionId]     = auctionId
                        it[balance]               = STARTING_BALANCE
                        it[createdAt]             = now
                        it[updatedAt]             = now
                    }
                }
            }
        }
    }

    /** Called when a new participant registers — give them 100CR for every active auction. */
    fun createForParticipantInAllActiveAuctions(participantId: UUID, activeAuctionIds: List<String>) {
        val now = Instant.now().toEpochMilli()
        transaction {
            activeAuctionIds.forEach { auctionId ->
                val alreadyExists = Wallets.selectAll()
                    .where {
                        (Wallets.participantId eq EntityID(participantId, Participants)) and
                                (Wallets.auctionId eq auctionId)
                    }.count() > 0

                if (!alreadyExists) {
                    Wallets.insert {
                        it[id]                    = UUID.randomUUID()
                        it[Wallets.participantId] = EntityID(participantId, Participants)
                        it[Wallets.auctionId]     = auctionId
                        it[balance]               = STARTING_BALANCE
                        it[createdAt]             = now
                        it[updatedAt]             = now
                    }
                }
            }
        }
    }

    fun findByParticipantAndAuction(participantId: UUID, auctionId: String): Wallet? =
        transaction {
            Wallets.selectAll()
                .where {
                    (Wallets.participantId eq EntityID(participantId, Participants)) and
                            (Wallets.auctionId eq auctionId)
                }
                .limit(1)
                .map { it.toWallet() }
                .singleOrNull()
        }

    fun findForUpdate(participantId: UUID, auctionId: String): Wallet? =
        Wallets.selectAll()
            .where {
                (Wallets.participantId eq EntityID(participantId, Participants)) and
                        (Wallets.auctionId eq auctionId)
            }
            .forUpdate()
            .limit(1)
            .map { it.toWallet() }
            .singleOrNull()

    fun decrementBalance(participantId: UUID, auctionId: String, amount: BigDecimal) {
        val now = Instant.now().toEpochMilli()
        transaction {
            Wallets.update(
                where = {
                    (Wallets.participantId eq EntityID(participantId, Participants)) and
                            (Wallets.auctionId eq auctionId)
                }
            ) {
                it[balance]   = balance - amount
                it[updatedAt] = now
            }
        }
    }

    fun incrementBalance(participantId: UUID, auctionId: String, amount: BigDecimal) {
        val now = Instant.now().toEpochMilli()
        Wallets.update(
            where = {
                (Wallets.participantId eq EntityID(participantId, Participants)) and
                        (Wallets.auctionId eq auctionId)
            }
        ) {
            it[balance]   = balance + amount
            it[updatedAt] = now
        }
    }

    fun findAllByAuction(auctionId: String): List<Wallet> =
        transaction {
            Wallets.selectAll()
                .where { Wallets.auctionId eq auctionId }
                .map { it.toWallet() }
        }

    fun leaderboard(auctionId: String): List<WalletLeaderboardResponse> =
        transaction {
            (Wallets innerJoin Participants)
                .selectAll()
                .where { Wallets.auctionId eq auctionId }
                .orderBy(Wallets.balance to SortOrder.DESC)
                .map {
                    WalletLeaderboardResponse(
                        participantId   = it[Participants.id].value,
                        participantName = it[Participants.name],
                        balance         = it[Wallets.balance]
                    )
                }
        }

    // ── CRUD ──────────────────────────────────────────────────────────────

    fun findAll(): List<Wallet> =
        transaction {
            Wallets.selectAll().map { it.toWallet() }
        }

    fun findById(id: UUID): Wallet? =
        transaction {
            Wallets.selectAll()
                .where { Wallets.id eq EntityID(id, Wallets) }
                .map { it.toWallet() }
                .singleOrNull()
        }

    fun updateBalance(id: UUID, newBalance: BigDecimal) {
        val now = Instant.now().toEpochMilli()
        transaction {
            Wallets.update({ Wallets.id eq EntityID(id, Wallets) }) {
                it[balance]   = newBalance
                it[updatedAt] = now
            }
        }
    }

    fun delete(id: UUID) {
        transaction {
            Wallets.deleteWhere { Wallets.id eq EntityID(id, Wallets) }
        }
    }

    fun resetAllWalletsToStartingBalance(auctionId: String) {
        val now = Instant.now().toEpochMilli()
        transaction {
            Wallets.update({ Wallets.auctionId eq auctionId }) {
                it[balance] = STARTING_BALANCE
                it[updatedAt] = now
            }
        }
    }
}