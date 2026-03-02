package com.example.ipl_backend.dto

data class LoginRequest(val email: String, val password: String)
data class SignupRequest(val name: String, val email: String, val password: String)
data class VerifyOtpRequest(val email: String, val otp: String)

data class UserResponse(
    val id: java.util.UUID,
    val name: String,
    val email: String,
    val role: com.example.ipl_backend.model.Role,
    val participantId: java.util.UUID
)