package com.example.ipl_backend.dto

import java.util.UUID

data class ParticipantResponse(
    val id: UUID,
    val name: String,
    val walletBalance: java.math.BigDecimal? = null
)