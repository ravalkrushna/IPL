package com.example.ipl_backend.repository

import com.example.ipl_backend.model.*
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import org.springframework.stereotype.Repository
import java.util.UUID

@Repository
class UserRepository {

    fun create(
        name: String,
        email: String,
        password: String,
        role: Role
    ): UUID {

        val userId = UUID.randomUUID()

        transaction {
            Users.insert {
                it[id] = userId
                it[Users.name] = name
                it[Users.email] = email
                it[Users.password] = password
                it[Users.role] = role.name
                it[Users.isVerified] = false
            }
        }

        return userId
    }

    // ✅ NORMAL USER CREATION
    fun createUser(name: String, email: String, password: String): UUID =
        create(name, email, password, Role.PARTICIPANT)

    // 🔥 ADMIN CREATION (WHAT YOU ASKED)
    fun createAdmin(name: String, email: String, password: String): UUID =
        create(name, email, password, Role.ADMIN)

    fun existsByEmail(email: String): Boolean =
        transaction {
            Users.selectAll()
                .where { Users.email eq email }
                .limit(1)
                .count() > 0
        }

    fun findByEmail(email: String): User? =
        transaction {
            Users.selectAll()
                .where { Users.email eq email }
                .limit(1)
                .map { row -> row.toUser() }
                .singleOrNull()
        }

    fun markVerified(email: String) {
        transaction {
            Users.update({ Users.email eq email }) {
                it[isVerified] = true
            }
        }
    }

    private fun ResultRow.toUser() = User(
        id = this[Users.id].value,   // ✅ UUIDTable fix
        name = this[Users.name],
        email = this[Users.email],
        password = this[Users.password],
        role = Role.valueOf(this[Users.role]),
        isVerified = this[Users.isVerified]
    )

    fun promoteToAdmin(email: String) {
        transaction {
            Users.update({ Users.email eq email }) {
                it[role] = Role.ADMIN.name
            }
        }
    }
}