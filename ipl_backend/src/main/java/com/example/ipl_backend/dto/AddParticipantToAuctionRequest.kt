package com.example.ipl_backend.dto

import java.util.UUID

data class AddParticipantToAuctionRequest(
    val participantId: UUID? = null,
    val newParticipantName: String? = null
)