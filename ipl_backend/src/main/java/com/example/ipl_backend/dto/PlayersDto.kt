package com.example.ipl_backend.dto

import java.math.BigDecimal


data class CreatePlayerRequest(
    val name: String,
    val country: String?,
    val age: Int?,
    val specialism: String?,
    val battingStyle: String?,
    val bowlingStyle: String?,
    val testCaps: Int? = 0,
    val odiCaps: Int? = 0,
    val t20Caps: Int? = 0,
    val basePrice: BigDecimal
)

data class UpdatePlayerRequest(
    val name: String,
    val country: String?,
    val age: Int?,
    val specialism: String?,
    val battingStyle: String?,
    val bowlingStyle: String?,
    val testCaps: Int,
    val odiCaps: Int,
    val t20Caps: Int,
    val basePrice: BigDecimal
)

data class ListPlayersRequest(
    val search: String? = null,
    val specialisms: List<String>? = null,
    val countries: List<String>? = null,
    val isSold: Boolean? = null,
    val getAll: Boolean? = false,
    val page: Int? = 1,
    val size: Int? = 20
)