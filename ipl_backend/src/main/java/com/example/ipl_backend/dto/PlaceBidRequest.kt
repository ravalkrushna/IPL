package com.example.ipl_backend.dto

import java.math.BigDecimal
import java.util.UUID

data class PlaceBidRequest(
    val playerId: String,
    val participantId: UUID,
    val auctionId: String,
    val amount: BigDecimal
)