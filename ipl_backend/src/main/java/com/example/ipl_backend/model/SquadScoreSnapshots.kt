package com.example.ipl_backend.model

import org.jetbrains.exposed.sql.Table

object SquadScoreSnapshots : Table("squad_score_snapshots") {

    val id = varchar("id", 255)
    val auctionId = varchar("auction_id", 255).references(Auctions.id)
    val squadId = varchar("squad_id", 255).references(Squads.id)
    val lockedPoints = integer("locked_points")
    val lockedAt = long("locked_at")

    override val primaryKey = PrimaryKey(id)

    init {
        uniqueIndex(auctionId, squadId)
    }
}

data class SquadScoreSnapshot(
    val id: String,
    val auctionId: String,
    val squadId: String,
    val lockedPoints: Int,
    val lockedAt: Long
)
