package com.example.ipl_backend.model

import org.jetbrains.exposed.dao.id.UUIDTable
import java.math.BigDecimal
import java.util.UUID

object BidLogs : UUIDTable("bid_logs") {

    val auctionId = varchar("auction_id", 255)
        .references(Auctions.id)
        .index()

    val playerId = varchar("player_id", 255)
        .references(Players.id)
        .nullable()   // ← add this
        .index()

    // Nullable — system events like PLAYER_UNSOLD have no participant
    val participantId = uuid("participant_id").nullable()

    val participantName = varchar("participant_name", 255).nullable()

    val squadName = varchar("squad_name", 255).nullable()

    val amount = decimal("amount", 18, 2).nullable()

    val bidType = enumerationByName("bid_type", 50, BidType::class)

    val createdAt = long("created_at")
}

data class BidLog(
    val id: UUID,
    val auctionId: String,
    val playerId: String?,  // ← String? not String
    val participantId: UUID?,
    val participantName: String?,
    val squadName: String?,
    val amount: BigDecimal?,
    val bidType: BidType,
    val createdAt: Long
)

enum class BidType {
    ONLINE_BID,       // Participant placed bid from device
    MANUAL_HAMMER,    // Admin typed amount + selected participant
    AUTO_HAMMER,      // Admin pressed hammer on highest online bidder
    PLAYER_UNSOLD,    // No bids — player went unsold
    PLAYER_PASSED,    // A participant passed on this player
    POOL_STARTED,     // Admin activated a pool
    POOL_ENDED,       // Admin ended a pool
    NEXT_PLAYER,      // Admin moved to next player
    ANALYSIS_STARTED  // Analysis timer started for player
}