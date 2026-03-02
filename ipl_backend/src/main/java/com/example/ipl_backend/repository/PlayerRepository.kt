package com.example.ipl_backend.repository

import com.example.ipl_backend.model.Player
import com.example.ipl_backend.model.Players
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction
import org.springframework.stereotype.Repository
import java.time.Instant

@Repository
class PlayerRepository {

    private fun ResultRow.toPlayer(): Player =
        Player(
            id           = this[Players.id],
            name         = this[Players.name],
            country      = this[Players.country],
            age          = this[Players.age],
            specialism   = this[Players.specialism],
            battingStyle = this[Players.battingStyle],
            bowlingStyle = this[Players.bowlingStyle],
            testCaps     = this[Players.testCaps],
            odiCaps      = this[Players.odiCaps],
            t20Caps      = this[Players.t20Caps],
            basePrice    = this[Players.basePrice],
            isSold       = this[Players.isSold],
            isAuctioned  = this[Players.isAuctioned],
            createdAt    = this[Players.createdAt],
            updatedAt    = this[Players.updatedAt]
        )

    fun save(player: Player) {
        transaction {
            Players.insert {
                it[id]           = player.id
                it[name]         = player.name
                it[country]      = player.country
                it[age]          = player.age
                it[specialism]   = player.specialism
                it[battingStyle] = player.battingStyle
                it[bowlingStyle] = player.bowlingStyle
                it[testCaps]     = player.testCaps
                it[odiCaps]      = player.odiCaps
                it[t20Caps]      = player.t20Caps
                it[basePrice]    = player.basePrice
                it[isSold]       = player.isSold
                it[isAuctioned]  = false
                it[createdAt]    = player.createdAt
                it[updatedAt]    = player.updatedAt
            }
        }
    }

    fun existsByName(name: String): Boolean =
        transaction {
            Players.selectAll()
                .where { Players.name.lowerCase() eq name.lowercase() }
                .count() > 0
        }

    fun findAll(
        search: String?,
        specialisms: List<String>?,
        countries: List<String>?,
        isSold: Boolean?,
        getAll: Boolean,
        page: Int,
        size: Int
    ): List<Player> = transaction {
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

    fun findAll(): List<Player> =
        transaction { Players.selectAll().map { it.toPlayer() } }

    fun findById(id: String): Player? =
        transaction {
            Players.selectAll()
                .where { Players.id eq id }
                .map { it.toPlayer() }
                .singleOrNull()
        }

    fun findByName(name: String): Player? =
        transaction {
            Players.selectAll()
                .where { Players.name.lowerCase() eq name.lowercase() }
                .firstOrNull()
                ?.toPlayer()
        }

    fun findByIds(ids: List<String>): List<Player> {
        if (ids.isEmpty()) return emptyList()
        return transaction {
            Players.selectAll()
                .where { Players.id inList ids }
                .map { it.toPlayer() }
        }
    }

    fun findSoldPlayers(): List<Player> =
        transaction {
            Players.selectAll()
                .where { Players.isSold eq true }
                .orderBy(Players.name)
                .map { it.toPlayer() }
        }

    fun findUnsoldPlayers(): List<Player> =
        transaction {
            Players.selectAll()
                .where { Players.isSold eq false }
                .orderBy(Players.name)
                .map { it.toPlayer() }
        }

    /** Next player in a specific pool (specialism) that hasn't been auctioned yet.
     *  Ordered by base price descending — biggest names go first. */
    fun findNextAvailablePlayerInPool(auctionId: String, specialism: String): Player? =
        transaction {
            Players.selectAll()
                .where {
                    (Players.isAuctioned eq false) and
                            (Players.specialism eq specialism)
                }
                .orderBy(Players.basePrice to SortOrder.DESC)
                .limit(1)
                .map { it.toPlayer() }
                .singleOrNull()
        }

    /** Legacy — kept for any callers that haven't migrated to pool-based yet */
    fun findNextAvailablePlayer(auctionId: String): Player? =
        transaction {
            Players.selectAll()
                .where { Players.isAuctioned eq false }
                .orderBy(Players.createdAt to SortOrder.ASC)
                .limit(1)
                .map { it.toPlayer() }
                .singleOrNull()
        }

    fun countBySpecialism(specialism: String): Long =
        transaction {
            Players.selectAll()
                .where { Players.specialism eq specialism }
                .count()
        }

    fun countAuctionedBySpecialism(specialism: String): Long =
        transaction {
            Players.selectAll()
                .where {
                    (Players.specialism eq specialism) and
                            (Players.isAuctioned eq true)
                }
                .count()
        }

    fun markAsSold(id: String) {
        transaction {
            val now = Instant.now().toEpochMilli()
            Players.update({ Players.id eq id }) {
                it[isSold]      = true
                it[isAuctioned] = true
                it[updatedAt]   = now
            }
        }
    }

    fun markAsUnsold(id: String) {
        transaction {
            val now = Instant.now().toEpochMilli()
            Players.update({ Players.id eq id }) {
                it[isSold]      = false
                it[isAuctioned] = true
                it[updatedAt]   = now
            }
        }
    }

    fun findForUpdate(id: String): Player? =
        Players.selectAll()
            .where { Players.id eq id }
            .forUpdate()
            .map { it.toPlayer() }
            .singleOrNull()

    fun updateStats(
        id: String,
        country: String?,
        age: Int?,
        specialism: String?,
        battingStyle: String?,
        bowlingStyle: String?,
        testCaps: Int,
        odiCaps: Int,
        t20Caps: Int,
        basePrice: java.math.BigDecimal,
        updatedAt: Long
    ) {
        transaction {
            Players.update({ Players.id eq id }) {
                it[Players.country]      = country
                it[Players.age]          = age
                it[Players.specialism]   = specialism
                it[Players.battingStyle] = battingStyle
                it[Players.bowlingStyle] = bowlingStyle
                it[Players.testCaps]     = testCaps
                it[Players.odiCaps]      = odiCaps
                it[Players.t20Caps]      = t20Caps
                it[Players.basePrice]    = basePrice
                it[Players.updatedAt]    = updatedAt
            }
        }
    }

    fun update(player: Player) {
        transaction {
            Players.update({ Players.id eq player.id }) {
                it[name]         = player.name
                it[country]      = player.country
                it[age]          = player.age
                it[specialism]   = player.specialism
                it[battingStyle] = player.battingStyle
                it[bowlingStyle] = player.bowlingStyle
                it[testCaps]     = player.testCaps
                it[odiCaps]      = player.odiCaps
                it[t20Caps]      = player.t20Caps
                it[basePrice]    = player.basePrice
                it[updatedAt]    = Instant.now().toEpochMilli()
            }
        }
    }

    fun resetAllPlayers() {
        transaction {
            val now = Instant.now().toEpochMilli()
            Players.update {
                it[isSold]      = false
                it[isAuctioned] = false
                it[updatedAt]   = now
            }
        }
    }

    fun delete(id: String) {
        transaction { Players.deleteWhere { Players.id eq id } }
    }
}