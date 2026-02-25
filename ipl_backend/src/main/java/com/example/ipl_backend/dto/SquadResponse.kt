package com.example.ipl_backend.dto

import com.example.ipl_backend.model.Player
import java.util.UUID

data class SquadResponse(
    val squadId: String,
    val participantId: UUID,
    val players: List<Player>
)