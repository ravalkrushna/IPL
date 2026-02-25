package com.example.ipl_backend.exception

class PlayerAlreadySoldException(
    message: String = "Player already sold"
) : RuntimeException(message)