package com.example.ipl_backend.dto

import java.math.BigDecimal

data class WalletResponse(
    val id: java.util.UUID,
    val participantId: java.util.UUID,
    val auctionId: String,
    val balance: BigDecimal
)