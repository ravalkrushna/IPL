package com.example.ipl_backend.model

import org.jetbrains.exposed.sql.Table

object PlayerNameAliases : Table("player_name_aliases") {

    val id       = varchar("id", 255)
    val playerId = varchar("player_id", 255).references(Players.id)
    val alias    = varchar("alias", 100).uniqueIndex()  // exactly as cricinfo shows it

    override val primaryKey = PrimaryKey(id)
}

data class PlayerNameAlias(
    val id: String,
    val playerId: String,
    val alias: String
)