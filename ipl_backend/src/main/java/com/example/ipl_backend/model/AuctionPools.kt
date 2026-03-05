package com.example.ipl_backend.model

import org.jetbrains.exposed.dao.id.UUIDTable
import java.util.UUID

object AuctionPools : UUIDTable("auction_pools") {

    val auctionId = varchar("auction_id", 255)
        .references(Auctions.id)

    val poolType = enumerationByName("pool_type", 50, PoolType::class)

    val status = enumerationByName("status", 50, PoolStatus::class)
        .default(PoolStatus.PENDING)

    val sequenceOrder = integer("sequence_order").default(0)

    val createdAt = long("created_at")
    val updatedAt = long("updated_at")

    init {
        // One pool type per auction
        uniqueIndex(auctionId, poolType)
    }
}

data class AuctionPool(
    val id: UUID,
    val auctionId: String,
    val poolType: PoolType,
    val status: PoolStatus,
    val sequenceOrder: Int,
    val createdAt: Long,
    val updatedAt: Long
)

enum class PoolType {
    ALL,
    BATSMAN,
    BOWLER,
    ALLROUNDER,   // ← must exactly match what's stored in auction_pools.pool_type
    WICKETKEEPER
}

enum class PoolStatus {
    PENDING,    // Not started yet
    ACTIVE,     // Currently running — only one can be ACTIVE per auction at a time
    PAUSED,     // Temporarily suspended — can be resumed later
    COMPLETED   // Permanently ended — cannot be restarted
}