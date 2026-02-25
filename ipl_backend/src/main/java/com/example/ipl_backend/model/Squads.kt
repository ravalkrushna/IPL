package com.example.ipl_backend.model

import org.jetbrains.exposed.sql.Table
import java.util.UUID

object Squads : Table("squads") {

    val id = varchar("id", 255)

    val participantId = uuid("participant_id")
        .references(Participants.id)

    val auctionId = varchar("auction_id", 255)
        .references(Auctions.id)

    val name = varchar("name", 255)   // ✅ ADD THIS

    val createdAt = long("created_at")

    override val primaryKey = PrimaryKey(id)

    init {
        uniqueIndex(participantId, auctionId)
    }
}

data class Squad(
    val id: String,
    val participantId: UUID,
    val name: String,
    val auctionId: String,
    val createdAt: Long
)