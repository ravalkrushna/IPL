package com.example.ipl_backend.model

import org.jetbrains.exposed.sql.Table

object Auctions : Table("auctions") {

    val id = varchar("id", 255)

    val name = varchar("name", 255)
        .uniqueIndex()

    val status = enumerationByName(
        "status",
        50,
        AuctionStatus::class
    )

    // How long (seconds) to show player stats before bidding opens
    val analysisTimerSecs = integer("analysis_timer_secs").default(30)

    // Minimum amount each bid must increase by (in rupees, e.g. 500000 = 5L)
    val minBidIncrement = decimal("min_bid_increment", 15, 2)
        .default(java.math.BigDecimal("500000.00"))

    val createdAt = long("created_at")
    val updatedAt = long("updated_at")

    override val primaryKey = PrimaryKey(id)
}

data class Auction(
    val id: String,
    val name: String,
    val status: AuctionStatus,
    val analysisTimerSecs: Int,
    val minBidIncrement: java.math.BigDecimal,
    val createdAt: Long,
    val updatedAt: Long
)

enum class AuctionStatus {
    PRE_AUCTION,
    LIVE,
    PAUSED,
    COMPLETED
}