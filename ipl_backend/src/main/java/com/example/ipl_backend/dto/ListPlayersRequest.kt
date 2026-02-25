package com.example.ipl_backend.dto

data class ListPlayersRequest(
    val search: String? = null,
    val specialisms: List<String>? = null,
    val countries: List<String>? = null,
    val isSold: Boolean? = null,
    val page: Int? = 1,
    val size: Int? = 20,
    val getAll: Boolean? = false
)