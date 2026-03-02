package com.example.ipl_backend.dto

data class MySquadResponse(
    val squadId: String,
    val name: String,
    val participantId: java.util.UUID,
    val players: List<SquadPlayerDetail>
)