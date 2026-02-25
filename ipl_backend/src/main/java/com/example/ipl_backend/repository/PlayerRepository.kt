package com.example.ipl_backend.repository

import com.example.ipl_backend.model.Player
import com.example.ipl_backend.model.PlayerPurchases
import com.example.ipl_backend.model.Players
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import org.springframework.stereotype.Repository

@Repository
class PlayerRepository {

    private fun ResultRow.toPlayer(): Player {
        return Player(
            id = this[Players.id],
            name = this[Players.name],
            country = this[Players.country],
            age = this[Players.age],
            specialism = this[Players.specialism],
            battingStyle = this[Players.battingStyle],
            bowlingStyle = this[Players.bowlingStyle],
            testCaps = this[Players.testCaps],
            odiCaps = this[Players.odiCaps],
            t20Caps = this[Players.t20Caps],
            basePrice = this[Players.basePrice],
            isSold = this[Players.isSold],
            isAuctioned = this[Players.isAuctioned],   // ← new field
            createdAt = this[Players.createdAt],
            updatedAt = this[Players.updatedAt]
        )
    }

    fun save(player: Player) {
        transaction {
            Players.insert {
                it[id] = player.id
                it[name] = player.name
                it[country] = player.country
                it[age] = player.age
                it[specialism] = player.specialism
                it[battingStyle] = player.battingStyle
                it[bowlingStyle] = player.bowlingStyle
                it[testCaps] = player.testCaps
                it[odiCaps] = player.odiCaps
                it[t20Caps] = player.t20Caps
                it[basePrice] = player.basePrice
                it[isSold] = player.isSold
                it[isAuctioned] = false
                it[createdAt] = player.createdAt
                it[updatedAt] = player.updatedAt
            }
        }
    }

    fun findById(id: String): Player? {
        return transaction {
            Players.selectAll()
                .where { Players.id eq id }
                .firstOrNull()
                ?.toPlayer()
        }
    }

    fun existsByName(name: String): Boolean {
        return transaction {
            Players.selectAll()
                .where { Players.name.lowerCase() eq name.lowercase() }
                .count() > 0
        }
    }

    fun findAll(
        search: String?,
        specialisms: List<String>?,
        countries: List<String>?,
        isSold: Boolean?,
        getAll: Boolean,
        page: Int,
        size: Int
    ): List<Player> {
        return transaction {
            var query = Players.selectAll()
            query = query.where {
                var condition: Op<Boolean> = Op.TRUE
                if (!search.isNullOrBlank()) {
                    condition = condition and (Players.name.lowerCase() like "%${search.lowercase()}%")
                }
                if (!specialisms.isNullOrEmpty()) {
                    condition = condition and (Players.specialism inList specialisms)
                }
                if (!countries.isNullOrEmpty()) {
                    condition = condition and (Players.country inList countries)
                }
                if (isSold != null) {
                    condition = condition and (Players.isSold eq isSold)
                }
                condition
            }
            query = query.orderBy(Players.createdAt to SortOrder.DESC)
            if (!getAll) {
                query = query.limit(size, ((page - 1) * size).toLong())
            }
            query.map { it.toPlayer() }
        }
    }

    fun findSoldPlayers(): List<Player> {
        return transaction {
            Players.selectAll()
                .where { Players.isSold eq true }
                .orderBy(Players.name)
                .map { it.toPlayer() }
        }
    }

    fun findUnsoldPlayers(): List<Player> {
        return transaction {
            Players.selectAll()
                .where { Players.isSold eq false }
                .orderBy(Players.name)
                .map { it.toPlayer() }
        }
    }

    fun findByIds(ids: List<String>): List<Player> {
        if (ids.isEmpty()) return emptyList()
        return transaction {
            Players.selectAll()
                .where { Players.id inList ids }
                .map { it.toPlayer() }
        }
    }

    fun markAsSold(playerId: String) {
        transaction {
            Players.update({ Players.id eq playerId }) {
                it[isSold] = true
                it[isAuctioned] = true   // ← mark as processed
                it[updatedAt] = System.currentTimeMillis()
            }
        }
    }

    fun markAsUnsold(playerId: String) {
        transaction {
            Players.update({ Players.id eq playerId }) {
                it[isSold] = false
                it[isAuctioned] = true   // ← CRITICAL: exclude from future rounds
                it[updatedAt] = System.currentTimeMillis()
            }
        }
    }

    fun findForUpdate(playerId: String): Player? =
        Players.selectAll()
            .where { Players.id eq playerId }
            .forUpdate()
            .limit(1)
            .map { it.toPlayer() }
            .singleOrNull()

    // ✅ FIXED: exclude players that have already been through the auction
    //    (both sold AND unsold) using isAuctioned flag.
    //    Previously only PlayerPurchases was checked — unsold players were
    //    never added there so they kept appearing as "available".
    fun findNextAvailablePlayer(auctionId: String): Player? =
        transaction {
            Players.selectAll()
                .where {
                    Players.isAuctioned eq false   // ← single clean condition
                }
                .orderBy(Players.createdAt to SortOrder.ASC)
                .limit(1)
                .map { it.toPlayer() }
                .singleOrNull()
        }
}