package com.example.ipl_backend.dto

import com.example.ipl_backend.model.Player
import java.math.BigDecimal
import java.util.UUID

data class ParticipantProfileResponse(
    val participantId: UUID,
    val walletBalance: BigDecimal,
    val squad: List<SquadPlayerDetail>
)