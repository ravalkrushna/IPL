package com.example.ipl_backend.model

import java.util.UUID
import org.jetbrains.exposed.dao.id.UUIDTable

object Users : UUIDTable("users") {

    val name = varchar("name", 255)
    val email = varchar("email", 255).uniqueIndex()
    val password = varchar("password", 255)
    val role = varchar("role", 50)
    val isVerified = bool("is_verified").default(false)
}


data class User(
    val id: UUID,
    val name: String,
    val email: String,
    val password: String,
    val role: Role,
    val isVerified: Boolean
)