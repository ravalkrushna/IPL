package com.example.ipl_backend.dto

import java.math.BigDecimal
import java.util.UUID

data class WalletLeaderboardResponse(
    val participantId: UUID,
    val participantName: String,
    val balance: BigDecimal
)