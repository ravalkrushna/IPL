package com.example.ipl_backend.dto

import java.math.BigDecimal
import java.util.UUID

data class WalletResponse(
    val participantId: UUID,
    val balance: BigDecimal
)