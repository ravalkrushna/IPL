package com.example.ipl_backend.model

import org.jetbrains.exposed.sql.Table

object UpcomingMatches : Table("upcoming_matches") {
    val id        = varchar("id", 255)           // CricAPI match id
    val matchNo   = integer("match_no")
    val teamA     = varchar("team_a", 100)
    val teamB     = varchar("team_b", 100)
    val matchDate = long("match_date")            // epoch millis (UTC)
    val season    = varchar("season", 10)
    val createdAt = long("created_at")

    override val primaryKey = PrimaryKey(id)
}

data class UpcomingMatch(
    val id: String,
    val matchNo: Int,
    val teamA: String,
    val teamB: String,
    val matchDate: Long,
    val season: String,
    val createdAt: Long
)