package com.example.ipl_backend.dto

data class ParticipantProfileResponse(
    val participantId: java.util.UUID,
    val walletBalance: java.math.BigDecimal,
    val squad: List<SquadPlayerDetail>
)