package com.example.ipl_backend.model

import org.jetbrains.exposed.sql.Table

object Otps : Table("otps") {

    val id = long("id").autoIncrement()
    val email = varchar("email", 255)
    val code = varchar("code", 10)
    val expiresAt = long("expires_at")

    override val primaryKey = PrimaryKey(id)
}