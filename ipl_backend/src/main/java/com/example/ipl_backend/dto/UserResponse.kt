package com.example.ipl_backend.dto

import com.example.ipl_backend.model.Role
import java.util.UUID

data class UserResponse(
    val id: UUID,
    val name: String,
    val email: String,
    val role: Role,
    val participantId: UUID
)