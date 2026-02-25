package com.example.ipl_backend.dto

import java.util.UUID

data class CreateSquadRequest(
    val participantId: UUID,
    val auctionId: String,
    val name: String
)