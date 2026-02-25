package com.example.ipl_backend.model

import java.math.BigDecimal
import org.jetbrains.exposed.sql.Table

object PlayerPurchases : Table("player_purchases") {

    val id = varchar("id", 255)

    val auctionId = varchar("auction_id", 255)
    val playerId = varchar("player_id", 255)
    val participantId = varchar("participant_id", 255)

    val purchasePrice = decimal("purchase_price", 15, 2)

    val createdAt = long("created_at")

    override val primaryKey = PrimaryKey(id)

    init {
        uniqueIndex(auctionId, playerId) // 🚀 prevents double sale
    }
}



data class PlayerPurchase(
    val id: String,
    val auctionId: String,
    val playerId: String,
    val participantId: String,
    val purchasePrice: BigDecimal,
    val createdAt: Long
)