package com.example.ipl_backend.exception

class SquadNotFoundException(
    message: String = "Squad not found"
) : RuntimeException(message)