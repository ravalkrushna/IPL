package com.example.ipl_backend.model

import org.jetbrains.exposed.sql.Table
import java.math.BigDecimal
import java.util.UUID

object Bids : Table("bids") {

    val id = varchar("id", 255)

    val playerId = varchar("player_id", 255)
        .index()

    val participantId = uuid("participant_id")   // ✅ UUID because Participants = UUIDTable
        .index()

    val auctionId = varchar("auction_id", 255)
        .index()

    val amount = decimal("amount", 18, 2)

    val createdAt = long("created_at")

    override val primaryKey = PrimaryKey(id)
}

data class Bid(
    val id: String,
    val playerId: String,
    val participantId: UUID,
    val auctionId: String,
    val amount: BigDecimal,
    val createdAt: Long
)