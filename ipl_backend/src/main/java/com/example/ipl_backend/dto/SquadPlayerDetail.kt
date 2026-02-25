// dto/SquadPlayerDetail.kt
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
    val soldPrice: BigDecimal
)