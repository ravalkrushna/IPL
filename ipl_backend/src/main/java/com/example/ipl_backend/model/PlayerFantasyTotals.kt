package com.example.ipl_backend.model

import org.jetbrains.exposed.sql.Table

object PlayerFantasyTotals : Table("player_fantasy_totals") {
    val id            = varchar("id", 255)
    val playerId      = varchar("player_id", 255).references(Players.id)
    val totalPoints   = integer("total_points").default(0)
    val matchesPlayed = integer("matches_played").default(0)
    val updatedAt     = long("updated_at")

    override val primaryKey = PrimaryKey(id)

    init {
        uniqueIndex(playerId)
    }
}

data class PlayerFantasyTotal(
    val id: String,
    val playerId: String,
    val totalPoints: Int,
    val matchesPlayed: Int,
    val updatedAt: Long
)