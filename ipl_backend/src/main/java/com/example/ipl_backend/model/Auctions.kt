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

    // Re-auction can be triggered only after the main auction is completed.
    val reauctionStarted = bool("reauction_started").default(false)
    val reauctionStartedAt = long("reauction_started_at").nullable()

    // Mid-season auction phase tracking
    val midSeasonPhase = enumerationByName("mid_season_phase", 50, MidSeasonPhase::class)
        .default(MidSeasonPhase.NOT_STARTED)
    val pointsLockedAt = long("points_locked_at").nullable()

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
    val reauctionStarted: Boolean = false,
    val reauctionStartedAt: Long? = null,
    val midSeasonPhase: MidSeasonPhase = MidSeasonPhase.NOT_STARTED,
    val pointsLockedAt: Long? = null,
    val createdAt: Long,
    val updatedAt: Long
)

enum class AuctionStatus {
    PRE_AUCTION,
    LIVE,
    PAUSED,
    COMPLETED
}

enum class MidSeasonPhase {
    NOT_STARTED,
    RETENTION_ENTRY,
    LIVE,
    COMPLETED
}