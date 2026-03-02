package com.example.ipl_backend.dto

import java.math.BigDecimal

data class UpdateAuctionRequest(
    val name: String,
    val analysisTimerSecs: Int,
    val minBidIncrement: BigDecimal
)
