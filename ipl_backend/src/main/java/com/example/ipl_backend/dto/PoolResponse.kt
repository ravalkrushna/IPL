package com.example.ipl_backend.dto

data class PoolResponse(
      val id: java.util.UUID,
      val auctionId: String,
      val poolType: String,
      val status: String,
      val sequenceOrder: Int,
      val totalPlayers: Long,
      val auctionedCount: Long,
      val remaining: Long
)