package com.example.ipl_backend.dto

data class VerifyOtpRequest(
    val email: String,
    val otp: String
)