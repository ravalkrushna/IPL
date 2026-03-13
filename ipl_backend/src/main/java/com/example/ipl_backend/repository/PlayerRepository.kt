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
            iplTeam      = this[Players.iplTeam],   // ← NEW
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
                it[iplTeam]      = player.iplTeam   // ← NEW
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

    fun findNextAvailablePlayerGlobal(auctionId: String): Player? =
        transaction {
            val allAvailable = Players.selectAll()
                .where { Players.isAuctioned eq false }
                .orderBy(Players.basePrice to SortOrder.DESC)
                .map { it.toPlayer() }

            if (allAvailable.isEmpty()) return@transaction null

            val highestPrice = allAvailable.first().basePrice
            val topTier = allAvailable.filter { it.basePrice == highestPrice }
            topTier.shuffled().first()
        }

    fun findUpcomingPlayersGlobal(excludeId: String?): List<Player> =
        transaction {
            val allAvailable = Players.selectAll()
                .where {
                    (Players.isAuctioned eq false) and
                            if (excludeId != null) (Players.id neq excludeId) else Op.TRUE
                }
                .orderBy(Players.basePrice to SortOrder.DESC)
                .map { it.toPlayer() }

            if (allAvailable.isEmpty()) return@transaction emptyList()

            allAvailable
                .groupBy { it.basePrice }
                .entries
                .sortedByDescending { it.key }
                .flatMap { (_, players) -> players.shuffled() }
                .take(5)
        }

    fun findNextAvailablePlayerInPool(auctionId: String, specialism: String): Player? =
        findNextAvailablePlayerGlobal(auctionId)

    fun findNextAvailablePlayer(auctionId: String): Player? =
        findNextAvailablePlayerGlobal(auctionId)

    fun countBySpecialism(specialism: String): Long =
        transaction {
            Players.selectAll()
                .where { Players.specialism eq specialism }
                .count()
        }

    fun countAll(): Long =
        transaction { Players.selectAll().count() }

    fun countAuctionedBySpecialism(specialism: String): Long =
        transaction {
            Players.selectAll()
                .where {
                    (Players.specialism eq specialism) and
                            (Players.isAuctioned eq true)
                }
                .count()
        }

    fun countAuctioned(): Long =
        transaction {
            Players.selectAll()
                .where { Players.isAuctioned eq true }
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

    fun markAsUnsoldIfNotAuctioned(id: String): Boolean =
        transaction {
            val player = Players.selectAll()
                .where { Players.id eq id }
                .forUpdate()
                .map { it.toPlayer() }
                .singleOrNull()

            if (player == null || player.isAuctioned) {
                return@transaction false
            }

            val now = Instant.now().toEpochMilli()
            Players.update({ Players.id eq id }) {
                it[isSold]      = false
                it[isAuctioned] = true
                it[updatedAt]   = now
            }
            println("✅ markAsUnsoldIfNotAuctioned: marked ${player.name} (id=$id) as UNSOLD")
            true
        }

    fun findForUpdate(id: String): Player? =
        transaction {
            Players.selectAll()
                .where { Players.id eq id }
                .forUpdate()
                .map { it.toPlayer() }
                .singleOrNull()
        }

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

    fun findUpcomingPlayersInPool(specialism: String, excludeId: String?): List<Player> =
        findUpcomingPlayersGlobal(excludeId)

    fun findByLastName(lastName: String): Player? =
               transaction {
                    Players.selectAll()
                        .where { Players.name.lowerCase() like "%${lastName.lowercase()}" }
                        .map { it.toPlayer() }
                        .singleOrNull()  // returns null if multiple match (ambiguous)
                }

    fun findAllByLastName(lastName: String): List<Player> =
        transaction {
            Players.selectAll()
                .where { Players.name.lowerCase() like "%${lastName.lowercase()}" }
                .map { it.toPlayer() }
        }
}