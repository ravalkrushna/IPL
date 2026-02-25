package com.example.ipl_backend.dto

import java.math.BigDecimal

data class AuctionEvent(
    val type: String,
    val playerId: String? = null,       // ✅ nullable — wallet/system events don't need a playerId
    val participantId: String? = null,
    val amount: BigDecimal? = null,
    val walletBalance: BigDecimal? = null,
    val message: String? = null,
    val squadName: String? = null
)