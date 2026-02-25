package com.example.ipl_backend.model

import org.jetbrains.exposed.dao.id.UUIDTable
import java.math.BigDecimal
import java.util.UUID

object Wallets : UUIDTable("wallets") {

    val participantId = reference(
        name = "participant_id",
        foreign = Participants
    ).uniqueIndex()

    val balance = decimal("balance", 15, 2)

    val createdAt = long("created_at")
    val updatedAt = long("updated_at")
}

data class Wallet(
    val id: UUID,
    val participantId: UUID,
    val balance: BigDecimal,
    val createdAt: Long,
    val updatedAt: Long
)