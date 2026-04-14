package com.example.ipl_backend.dto

import java.math.BigDecimal
data class SquadPlayerDetail(
    val id: String,
    val name: String,
    val country: String?,
    val age: Int?,
    val specialism: String?,
    val battingStyle: String?,
    val bowlingStyle: String?,
    val testCaps: Int,
    val odiCaps: Int,
    val t20Caps: Int,
    val basePrice: BigDecimal,
    val soldPrice: BigDecimal,
    // Epoch-millis of when this player joined the squad.
    // 0 = original auction buy (all season points count).
    // >0 = mid-season trade (only points from matches on/after this timestamp count).
    val joinedAt: Long = 0L
)