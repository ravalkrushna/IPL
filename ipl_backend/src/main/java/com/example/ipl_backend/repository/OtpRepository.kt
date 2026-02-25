package com.example.ipl_backend.repository

import com.example.ipl_backend.model.Otps
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.deleteWhere
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.selectAll
import org.springframework.stereotype.Repository

@Repository
class OtpRepository {

    fun save(email: String, code: String, expiry: Long) {

        Otps.insert {
            it[Otps.email] = email
            it[Otps.code] = code
            it[expiresAt] = expiry
        }
    }

    fun findValidOtp(email: String): ResultRow? =
        Otps.selectAll()
            .where {
                (Otps.email eq email) and
                        (Otps.expiresAt greaterEq System.currentTimeMillis())
            }
            .singleOrNull()

    fun delete(email: String) {
        Otps.deleteWhere { Otps.email eq email }
    }
}