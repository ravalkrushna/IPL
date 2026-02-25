package com.example.ipl_backend.exception

class InsufficientBalanceException(
    message: String = "Insufficient balance"
) : RuntimeException(message)