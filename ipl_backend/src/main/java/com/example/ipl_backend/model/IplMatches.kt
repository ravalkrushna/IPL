package com.example.ipl_backend.model

import org.jetbrains.exposed.sql.Table

object IplMatches : Table("ipl_matches") {

    val id          = varchar("id", 255)
    val matchNo     = integer("match_no")
    val teamA       = varchar("team_a", 100)
    val teamB       = varchar("team_b", 100)
    val matchDate   = long("match_date")       // epoch millis
    val cricinfoUrl = varchar("cricinfo_url", 500).nullable()
    val isScraped   = bool("is_scraped").default(false)
    val season      = varchar("season", 10).nullable()  // "2025", "2026"; null = legacy seeded data
    val createdAt   = long("created_at")

    override val primaryKey = PrimaryKey(id)
}

data class IplMatch(
    val id: String,
    val matchNo: Int,
    val teamA: String,
    val teamB: String,
    val matchDate: Long,
    val cricinfoUrl: String?,
    val isScraped: Boolean,
    val season: String?,
    val createdAt: Long
)