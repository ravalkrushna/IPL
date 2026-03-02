package com.example.ipl_backend.dto

import java.math.BigDecimal

data class ParticipantListResponse(
    val id: java.util.UUID,
    val name: String,
    val squadName: String?,
    val walletBalance: BigDecimal?
)
