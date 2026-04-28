package com.example.ipl_backend.model

import org.jetbrains.exposed.sql.Table
import java.math.BigDecimal

// 1 Crore = 10,000,000 raw units (same scale as STARTING_BALANCE = 1,000,000,000)
val RETENTION_COSTS: Map<Int, BigDecimal> = mapOf(
    1 to BigDecimal("40000000.00"),   // 4 CR
    2 to BigDecimal("80000000.00"),   // 8 CR
    3 to BigDecimal("120000000.00"),  // 12 CR
    4 to BigDecimal("160000000.00")   // 16 CR
)

object MidSeasonRetentions : Table("mid_season_retentions") {

    val id = varchar("id", 255)
    val auctionId = varchar("auction_id", 255).references(Auctions.id)
    val squadId = varchar("squad_id", 255).references(Squads.id)
    val playerId = varchar("player_id", 255).references(Players.id)
    val retentionOrder = integer("retention_order") // 1–4; determines cost slot
    val retentionCost = decimal("retention_cost", 18, 2)
    val createdAt = long("created_at")

    override val primaryKey = PrimaryKey(id)

    init {
        uniqueIndex(auctionId, squadId, playerId)
    }
}

data class MidSeasonRetention(
    val id: String,
    val auctionId: String,
    val squadId: String,
    val playerId: String,
    val playerName: String,
    val retentionOrder: Int,
    val retentionCost: BigDecimal,
    val createdAt: Long
)
