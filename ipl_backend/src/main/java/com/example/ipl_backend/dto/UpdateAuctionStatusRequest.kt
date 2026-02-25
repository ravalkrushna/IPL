package com.example.ipl_backend.dto

import com.example.ipl_backend.model.AuctionStatus

data class UpdateAuctionStatusRequest(
    val status: AuctionStatus
)