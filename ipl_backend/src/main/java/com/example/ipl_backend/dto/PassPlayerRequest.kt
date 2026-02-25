package com.example.ipl_backend.dto

import java.util.UUID

data class PassPlayerRequest(
    val auctionId: String,
    val playerId: String,
    val participantId: UUID
)