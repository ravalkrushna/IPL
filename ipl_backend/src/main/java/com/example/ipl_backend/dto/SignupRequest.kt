package com.example.ipl_backend.dto

data class SignupRequest(
    val name: String,
    val email: String,
    val password: String
)