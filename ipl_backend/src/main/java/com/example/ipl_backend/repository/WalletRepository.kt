package com.example.ipl_backend.repository

import com.example.ipl_backend.dto.WalletLeaderboardResponse
import com.example.ipl_backend.dto.WalletResponse
import com.example.ipl_backend.model.Wallet
import com.example.ipl_backend.model.Wallets
import com.example.ipl_backend.model.Participants
import org.jetbrains.exposed.dao.id.EntityID
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import org.springframework.stereotype.Repository
import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

@Repository
class WalletRepository {

    private fun ResultRow.toWallet(): Wallet =
        Wallet(
            id = this[Wallets.id].value,
            participantId = this[Wallets.participantId].value,
            balance = this[Wallets.balance],
            createdAt = this[Wallets.createdAt],
            updatedAt = this[Wallets.updatedAt]
        )

    fun create(participantId: UUID) {
        val now = Instant.now().toEpochMilli()
        transaction {
            Wallets.insert {
                it[id] = UUID.randomUUID()
                it[Wallets.participantId] = EntityID(participantId, Participants)
                it[balance] = BigDecimal("100000000.00")
                it[createdAt] = now
                it[updatedAt] = now
            }
        }
    }

    fun findByParticipantId(participantId: UUID): Wallet? =
        transaction {
            Wallets.selectAll()
                .where { Wallets.participantId eq EntityID(participantId, Participants) }
                .limit(1)
                .map { it.toWallet() }
                .singleOrNull()
        }

    fun updateBalance(participantId: UUID, newBalance: BigDecimal) {
        transaction {
            Wallets.update(
                where = { Wallets.participantId eq EntityID(participantId, Participants) }
            ) {
                it[balance] = newBalance
                it[updatedAt] = Instant.now().toEpochMilli()
            }
        }
    }

    // ✅ FIXED: wrap participantId in EntityID
    fun findForUpdate(participantId: UUID): Wallet? = transaction {

        Wallets.selectAll()
            .where { Wallets.participantId eq EntityID(participantId, Participants) }
            .forUpdate()
            .limit(1)
            .map { it.toWallet() }
            .singleOrNull()
    }

    // ✅ FIXED: wrap participantId in EntityID
    fun decrementBalance(participantId: UUID, amount: BigDecimal) = transaction {

        val now = Instant.now().toEpochMilli()

        Wallets.update(
            where = { Wallets.participantId eq EntityID(participantId, Participants) }
        ) {
            with(SqlExpressionBuilder) {
                it.update(balance, balance - amount)
            }
            it[updatedAt] = now
        }
    }

    // ✅ FIXED: wrap participantId in EntityID
    fun incrementBalance(participantId: UUID, amount: BigDecimal) {
        val now = Instant.now().toEpochMilli()
        Wallets.update(
            where = { Wallets.participantId eq EntityID(participantId, Participants) }
        ) {
            with(SqlExpressionBuilder) {
                it.update(balance, balance + amount)
            }
            it[updatedAt] = now
        }
    }

    fun leaderboard(): List<WalletLeaderboardResponse> = transaction {

        (Wallets innerJoin Participants)
            .selectAll()
            .orderBy(Wallets.balance to SortOrder.DESC)
            .map {

                WalletLeaderboardResponse(
                    participantId = it[Participants.id].value,
                    participantName = it[Participants.name],   // 🔥 UI NEEDS THIS
                    balance = it[Wallets.balance]
                )
            }
    }
}