package com.example.ipl_backend.dto

data class CreateSquadRequest(
    val participantId: java.util.UUID,
    val auctionId: String,
    val name: String
)
