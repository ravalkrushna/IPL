package com.example.ipl_backend.dto

import java.math.BigDecimal

data class PlaceBidRequest(
    val playerId: String,
    val participantId: java.util.UUID,
    val auctionId: String,
    val amount: BigDecimal
)