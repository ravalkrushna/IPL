package com.example.ipl_backend.dto

import com.example.ipl_backend.model.TradeStatus
import com.example.ipl_backend.model.TradeType
import java.math.BigDecimal

data class CreateTradeRequest(
    val auctionId: String,
    val fromSquadId: String,
    val toSquadId: String,
    val fromPlayerIds: List<String> = emptyList(),
    val toPlayerIds: List<String> = emptyList(),
    val cashFromToTo: BigDecimal = BigDecimal.ZERO,
    val cashToToFrom: BigDecimal = BigDecimal.ZERO
)

data class CreateSellListingRequest(
    val auctionId: String,
    val fromSquadId: String,
    val playerId: String,
    val askingPrice: BigDecimal
)

data class AcceptSellListingRequest(
    val buyerSquadId: String
)

data class CreateLoanRequest(
    val auctionId: String,
    val fromSquadId: String,
    val playerId: String,
    val loanFee: BigDecimal = BigDecimal.ZERO
)

data class ApproveLoanRequest(
    val borrowerSquadId: String
)

data class TradeResponse(
    val id: String,
    val auctionId: String,
    val fromSquadId: String,
    val toSquadId: String,
    val fromPlayerIds: List<String>,
    val toPlayerIds: List<String>,
    val cashFromToTo: BigDecimal,
    val cashToToFrom: BigDecimal,
    val tradeType: TradeType,
    val status: TradeStatus,
    val createdAt: Long,
    val updatedAt: Long
)

