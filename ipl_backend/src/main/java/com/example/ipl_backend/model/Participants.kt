package com.example.ipl_backend.model

import java.util.UUID
import org.jetbrains.exposed.dao.id.UUIDTable

object Participants : UUIDTable("participants") {

    val userId = reference(
        name = "user_id",
        foreign = Users
    ).nullable()   // removed uniqueIndex() — multiple offline participants would all be null

    val name = varchar("name", 255)

    val createdAt = long("created_at")
    val updatedAt = long("updated_at")
}

data class Participant(
    val id: UUID,
    val userId: UUID?,   // null for offline/manual participants
    val name: String,
    val createdAt: Long,
    val updatedAt: Long
)