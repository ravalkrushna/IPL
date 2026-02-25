package com.example.ipl_backend.dto

import java.math.BigDecimal
import java.util.UUID

data class HighestBidResponse(
    val playerId: String,
    val participantId: UUID?,
    val amount: BigDecimal
)