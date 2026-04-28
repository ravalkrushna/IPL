package com.example.ipl_backend.model

import org.jetbrains.exposed.sql.Table
import java.math.BigDecimal

object SquadSnapshotPlayers : Table("squad_snapshot_players") {

    val id          = varchar("id", 255)
    val auctionId   = varchar("auction_id", 255).references(Auctions.id)
    val squadId     = varchar("squad_id", 255).references(Squads.id)
    val playerId    = varchar("player_id", 255)
    val playerName  = varchar("player_name", 255)
    val specialism  = varchar("specialism", 100).nullable()
    val iplTeam     = varchar("ipl_team", 255).nullable()
    val soldPrice   = decimal("sold_price", 18, 2).nullable()
    val points      = integer("points")
    val joinedAt    = long("joined_at")

    override val primaryKey = PrimaryKey(id)

    init {
        uniqueIndex(auctionId, squadId, playerId)
    }
}

data class SquadSnapshotPlayer(
    val id: String,
    val auctionId: String,
    val squadId: String,
    val playerId: String,
    val playerName: String,
    val specialism: String?,
    val iplTeam: String?,
    val soldPrice: BigDecimal?,
    val points: Int,
    val joinedAt: Long
)
