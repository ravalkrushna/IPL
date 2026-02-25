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

enum class AuctionStatus {
    PRE_AUCTION,
    LIVE,
    PAUSED,
    COMPLETED
}