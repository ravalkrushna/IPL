package com.example.ipl_backend.model

import org.jetbrains.exposed.sql.Table

object SquadPlayers : Table("squad_players") {

    val id = varchar("id", 255)

    val squadId = varchar("squad_id", 255)
        .references(Squads.id)   // ✅ FK

    val playerId = varchar("player_id", 255)
        .references(Players.id)  // ✅ FK

    val purchasePrice = decimal("purchase_price", 18, 2)

    override val primaryKey = PrimaryKey(id)

    init {
        uniqueIndex(squadId, playerId)  // ✅ Prevent duplicates
    }
}