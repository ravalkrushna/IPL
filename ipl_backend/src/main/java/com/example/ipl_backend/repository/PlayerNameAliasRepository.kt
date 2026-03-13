package com.example.ipl_backend.repository

import com.example.ipl_backend.model.PlayerNameAlias
import com.example.ipl_backend.model.PlayerNameAliases
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction
import org.springframework.stereotype.Repository

@Repository
class PlayerNameAliasRepository {

    private fun ResultRow.toAlias(): PlayerNameAlias =
        PlayerNameAlias(
            id       = this[PlayerNameAliases.id],
            playerId = this[PlayerNameAliases.playerId],
            alias    = this[PlayerNameAliases.alias]
        )

    fun save(alias: PlayerNameAlias) {
        transaction {
            PlayerNameAliases.insert {
                it[id]       = alias.id
                it[playerId] = alias.playerId
                it[PlayerNameAliases.alias] = alias.alias
            }
        }
    }

    // The main lookup — given a name from Cricinfo, find the matching player ID
    // Checks alias table first, then falls back to exact player name match
    fun findPlayerIdByName(name: String): String? =
        transaction {
            PlayerNameAliases.selectAll()
                .where { PlayerNameAliases.alias.lowerCase() eq name.lowercase() }
                .map { it[PlayerNameAliases.playerId] }
                .singleOrNull()
        }

    fun findByPlayerId(playerId: String): List<PlayerNameAlias> =
        transaction {
            PlayerNameAliases.selectAll()
                .where { PlayerNameAliases.playerId eq playerId }
                .map { it.toAlias() }
        }

    fun findAll(): List<PlayerNameAlias> =
        transaction {
            PlayerNameAliases.selectAll().map { it.toAlias() }
        }

    fun delete(id: String) {
        transaction {
            PlayerNameAliases.deleteWhere { PlayerNameAliases.id eq id }
        }
    }
}