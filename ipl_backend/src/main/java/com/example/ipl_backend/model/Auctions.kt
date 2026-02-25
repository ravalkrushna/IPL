package com.example.ipl_backend.model

import org.jetbrains.exposed.sql.Table

object Auctions : Table("auctions") {

    val id = varchar("id", 255)

    val name = varchar("name", 255)
        .uniqueIndex()   // ✅ Prevent duplicates

    val status = enumerationByName(
        "status",
        50,
        AuctionStatus::class
    )   // ✅ Type-safe enum storage

    val createdAt = long("created_at")
    val updatedAt = long("updated_at")

    override val primaryKey = PrimaryKey(id)
}

data class Auction(
    val id: String,
    val name: String,
    val status: AuctionStatus,
    val createdAt: Long,
    val updatedAt: Long
)

enum class
AuctionStatus {
    PRE_AUCTION,
    LIVE,
    COMPLETED
}