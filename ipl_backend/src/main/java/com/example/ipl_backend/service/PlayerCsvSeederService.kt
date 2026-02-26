package com.example.ipl_backend.service

import com.example.ipl_backend.model.Player
import com.example.ipl_backend.repository.PlayerRepository
import org.apache.commons.csv.CSVFormat
import org.apache.commons.csv.CSVParser
import org.springframework.core.io.ClassPathResource
import org.springframework.stereotype.Component
import java.io.InputStreamReader
import java.math.BigDecimal
import java.nio.charset.StandardCharsets
import java.time.Instant
import java.util.*

@Component
class PlayerCsvSeederService(
    private val playerRepository: PlayerRepository
) {

    fun seed() {

        val resource = ClassPathResource("datasets/IPL_Auction_2022_FullList.csv")

        val parser = CSVParser(
            InputStreamReader(resource.inputStream, StandardCharsets.UTF_8),
            CSVFormat.DEFAULT.withFirstRecordAsHeader().withTrim()
        )

        println("📋 CSV Headers: ${parser.headerNames}")

        parser.forEach { record ->

            val name = record.get("Players")

            val country      = record.get("Country").ifBlank { null }
            val age          = record.get("Age").toDoubleOrNull()?.toInt()
            val specialism   = record.get("Specialism").ifBlank { null }
            val battingStyle = record.get("Batting Style").ifBlank { null }
            val bowlingStyle = record.get("Bowling Style").ifBlank { null }

            // ✅ Caps are stored as floats ("84.0") in the CSV — parse via Double
            val testCaps = record.get("Test caps").toDoubleOrNull()?.toInt() ?: 0
            val odiCaps  = record.get("ODI caps").toDoubleOrNull()?.toInt()  ?: 0
            val t20Caps  = record.get("T20 caps").toDoubleOrNull()?.toInt()  ?: 0

            val reservePriceLakh = record.get("Reserve Price Rs Lakh").toDoubleOrNull()
                ?.let { BigDecimal.valueOf(it) } ?: BigDecimal.ZERO
            val basePrice = reservePriceLakh.multiply(BigDecimal(100000))

            val now = Instant.now().toEpochMilli()

            val existing = playerRepository.findByName(name)

            if (existing != null) {
                playerRepository.updateStats(
                    id           = existing.id,
                    country      = country,
                    age          = age,
                    specialism   = specialism,
                    battingStyle = battingStyle,
                    bowlingStyle = bowlingStyle,
                    testCaps     = testCaps,
                    odiCaps      = odiCaps,
                    t20Caps      = t20Caps,
                    basePrice    = basePrice,
                    updatedAt    = now
                )
                println("🔄 Updated: $name (T:$testCaps O:$odiCaps T20:$t20Caps)")
            } else {
                val player = Player(
                    id           = UUID.randomUUID().toString(),
                    name         = name,
                    country      = country,
                    age          = age,
                    specialism   = specialism,
                    battingStyle = battingStyle,
                    bowlingStyle = bowlingStyle,
                    testCaps     = testCaps,
                    odiCaps      = odiCaps,
                    t20Caps      = t20Caps,
                    basePrice    = basePrice,
                    isSold       = false,
                    createdAt    = now,
                    updatedAt    = now
                )
                playerRepository.save(player)
                println("✅ Seeded: $name (T:$testCaps O:$odiCaps T20:$t20Caps)")
            }
        }

        parser.close()
        println("🏏 Seeding complete")
    }
}