package com.example.ipl_backend.model

import org.jetbrains.exposed.sql.Table

object SquadPlayers : Table("squad_players") {

    val id = varchar("id", 255)

    val squadId = varchar("squad_id", 255)
        .references(Squads.id)   // ✅ FK

    val playerId = varchar("player_id", 255)
        .references(Players.id)  // ✅ FK

    val purchasePrice = decimal("purchase_price", 18, 2)

    // Epoch-millis timestamp of when this player joined this squad.
    // 0 = bought at auction (counts from season start).
    // > 0 = arrived via trade; only points from matches on/after this date count.
    val joinedAt = long("joined_at").default(0L)

    override val primaryKey = PrimaryKey(id)

    init {
        uniqueIndex(squadId, playerId)  // ✅ Prevent duplicates
    }
}