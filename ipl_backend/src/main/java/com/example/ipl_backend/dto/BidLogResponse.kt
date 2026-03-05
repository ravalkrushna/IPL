package com.example.ipl_backend.dto

import java.math.BigDecimal


data class BidLogResponse(
    val id: java.util.UUID,
    val auctionId: String,
    val playerId: String?,
    val participantId: java.util.UUID?,
    val participantName: String?,
    val squadName: String?,
    val amount: BigDecimal?,
    val bidType: String,
    val createdAt: Long
)