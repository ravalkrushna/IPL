package com.example.ipl_backend.service

import com.example.ipl_backend.model.Players
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.transaction
import org.jetbrains.exposed.sql.update
import org.springframework.stereotype.Service
import java.math.BigDecimal

@Service
class BasePriceSeederService {

    data class SeedResult(val updated: Int, val skipped: Int)

    companion object {
        val FLAT_BASE_PRICE: BigDecimal = BigDecimal("5000000")   // ₹50 Lakhs
    }

    fun seed(): SeedResult {
        var updated = 0
        var skipped = 0

        transaction {
            val players = Players.selectAll().toList()

            for (row in players) {
                val current = row[Players.basePrice]

                if (current == FLAT_BASE_PRICE) {
                    skipped++
                    continue
                }

                Players.update({ Players.id eq row[Players.id] }) {
                    it[basePrice] = FLAT_BASE_PRICE
                }
                updated++
            }
        }

        println("💰 Base price seed complete — updated=$updated skipped=$skipped")
        return SeedResult(updated, skipped)
    }
}