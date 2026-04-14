package com.example.ipl_backend.model

import org.jetbrains.exposed.sql.Table

object Trades : Table("trades") {
    val id = varchar("id", 255)
    val auctionId = varchar("auction_id", 255).references(Auctions.id)
    val fromSquadId = varchar("from_squad_id", 255).references(Squads.id)
    val toSquadId = varchar("to_squad_id", 255).references(Squads.id)

    // CSV strings keep schema simple while supporting 1-for-1, 1-for-2, etc.
    val fromPlayerIdsCsv = text("from_player_ids_csv")
    val toPlayerIdsCsv = text("to_player_ids_csv")

    // Money legs in both directions.
    val cashFromToTo = decimal("cash_from_to_to", 18, 2).default(java.math.BigDecimal.ZERO)
    val cashToToFrom = decimal("cash_to_to_from", 18, 2).default(java.math.BigDecimal.ZERO)
    val tradeType = enumerationByName("trade_type", 24, TradeType::class).default(TradeType.TRADE)

    // True when the counterparty is the unsold player pool, not a real squad.
    val isUnsoldPoolTrade = bool("is_unsold_pool_trade").default(false)

    val status = enumerationByName("status", 32, TradeStatus::class)
    val createdAt = long("created_at")
    val updatedAt = long("updated_at")

    override val primaryKey = PrimaryKey(id)
}

enum class TradeStatus {
    PENDING,
    ACCEPTED,
    CLOSED,
    REJECTED,
    CANCELLED
}

enum class TradeType {
    TRADE,
    SELL,
    LOAN
}

