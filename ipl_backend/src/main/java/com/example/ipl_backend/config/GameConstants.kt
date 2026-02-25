package com.example.ipl_backend.config

import java.math.BigDecimal

object GameConstants {

    val ONE_CR = BigDecimal(10_000_000)

    val INITIAL_WALLET_BALANCE = ONE_CR.multiply(BigDecimal(100))!!
}