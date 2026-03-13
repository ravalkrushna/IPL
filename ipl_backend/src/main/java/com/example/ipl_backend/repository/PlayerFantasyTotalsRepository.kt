package com.example.ipl_backend.repository

import com.example.ipl_backend.model.PlayerFantasyTotal
import com.example.ipl_backend.model.PlayerFantasyTotals
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import org.springframework.stereotype.Repository
import java.time.Instant

@Repository
class PlayerFantasyTotalsRepository {

    private fun ResultRow.toTotal(): PlayerFantasyTotal =
        PlayerFantasyTotal(
            id            = this[PlayerFantasyTotals.id],
            playerId      = this[PlayerFantasyTotals.playerId],
            totalPoints   = this[PlayerFantasyTotals.totalPoints],
            matchesPlayed = this[PlayerFantasyTotals.matchesPlayed],
            updatedAt     = this[PlayerFantasyTotals.updatedAt]
        )

    fun addPoints(playerId: String, pointsToAdd: Int) {
        transaction {
            val existing = PlayerFantasyTotals.selectAll()
                .where { PlayerFantasyTotals.playerId eq playerId }
                .singleOrNull()

            val now = Instant.now().toEpochMilli()

            if (existing != null) {
                PlayerFantasyTotals.update({ PlayerFantasyTotals.playerId eq playerId }) {
                    it[totalPoints]   = existing[PlayerFantasyTotals.totalPoints] + pointsToAdd
                    it[matchesPlayed] = existing[PlayerFantasyTotals.matchesPlayed] + 1
                    it[updatedAt]     = now
                }
            } else {
                PlayerFantasyTotals.insert {
                    it[PlayerFantasyTotals.id]            = java.util.UUID.randomUUID().toString()
                    it[PlayerFantasyTotals.playerId]      = playerId
                    it[PlayerFantasyTotals.totalPoints]   = pointsToAdd
                    it[PlayerFantasyTotals.matchesPlayed] = 1
                    it[PlayerFantasyTotals.updatedAt]     = now
                }
            }
        }
    }

    fun findByPlayerIds(playerIds: List<String>): List<PlayerFantasyTotal> =
        transaction {
            if (playerIds.isEmpty()) return@transaction emptyList()
            PlayerFantasyTotals.selectAll()
                .where { PlayerFantasyTotals.playerId inList playerIds }
                .map { it.toTotal() }
        }

    fun findAll(): List<PlayerFantasyTotal> =
        transaction {
            PlayerFantasyTotals.selectAll()
                .orderBy(PlayerFantasyTotals.totalPoints to SortOrder.DESC)
                .map { it.toTotal() }
        }

    // Removes all rows so the 2026 fantasy competition starts from zero.
    fun deleteAll(): Int =
        transaction {
            PlayerFantasyTotals.deleteAll()
        }
}