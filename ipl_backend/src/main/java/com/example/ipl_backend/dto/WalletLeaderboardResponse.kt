package com.example.ipl_backend.dto

import java.math.BigDecimal
data class WalletLeaderboardResponse(
    val participantId: java.util.UUID,
    val participantName: String,
    val balance: BigDecimal
)
