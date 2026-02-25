package com.example.ipl_backend.dto

import java.util.UUID

data class MySquadResponse(
    val squadId: String,
    val name: String,
    val participantId: UUID,
    val players: List<SquadPlayerDetail>  // ← changed from List<Player>
)