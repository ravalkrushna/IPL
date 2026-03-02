package com.example.ipl_backend.dto

import java.math.BigDecimal

data class ManualHammerRequest(
    val playerId: String,
    val auctionId: String,
    val participantId: java.util.UUID? = null,
    val newParticipantName: String? = null,
    val finalAmount: BigDecimal
)