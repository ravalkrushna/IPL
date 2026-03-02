package com.example.ipl_backend.dto



data class SquadResponse(
    val squadId: String,
    val participantId: java.util.UUID,
    val players: List<com.example.ipl_backend.model.Player>
)