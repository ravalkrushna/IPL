package com.example.ipl_backend.dto

import java.math.BigDecimal


data class HighestBidResponse(
    val playerId: String,
    val participantId: java.util.UUID?,
    val participantName: String?,
    val amount: BigDecimal,
    val isManual: Boolean
)