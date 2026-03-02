package com.example.ipl_backend.dto

data class UpdateAuctionStatusRequest(
    val status: com.example.ipl_backend.model.AuctionStatus
)