package com.example.ipl_backend.dto

import java.math.BigDecimal

data class CreateAuctionRequest(
    val name: String,
    val analysisTimerSecs: Int? = 30,
    val minBidIncrement: BigDecimal? = BigDecimal("500000.00")
)
