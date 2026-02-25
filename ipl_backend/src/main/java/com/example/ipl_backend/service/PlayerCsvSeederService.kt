package com.example.ipl_backend.service


import com.example.ipl_backend.model.Player
import com.example.ipl_backend.repository.PlayerRepository
import org.apache.commons.csv.CSVFormat
import org.apache.commons.csv.CSVParser
import org.springframework.core.io.ClassPathResource
import org.springframework.stereotype.Component
import java.io.InputStreamReader
import java.math.BigDecimal
import java.time.Instant
import java.util.*

@Component
class PlayerCsvSeederService(
    private val playerRepository: PlayerRepository
) {

    fun seed() {

        val resource = ClassPathResource("datasets/IPL_Auction_2022_FullList.csv")

        val parser = CSVParser(
            InputStreamReader(resource.inputStream),
            CSVFormat.DEFAULT.withFirstRecordAsHeader().withTrim()
        )

        parser.forEach { record ->

            val name = record.get("Players")

            // ✅ Duplicate protection
            if (playerRepository.existsByName(name)) {
                return@forEach
            }

            val country = record.get("Country").ifBlank { null }
            val age = record.get("Age").toIntOrNull()
            val specialism = record.get("Specialism").ifBlank { null }
            val battingStyle = record.get("Batting Style").ifBlank { null }
            val bowlingStyle = record.get("Bowling Style").ifBlank { null }

            val testCaps = record.get("Test caps").toIntOrNull() ?: 0
            val odiCaps = record.get("ODI caps").toIntOrNull() ?: 0
            val t20Caps = record.get("T20 caps").toIntOrNull() ?: 0

            // ✅ Base price conversion (Lakh → Numeric)
            val reservePriceLakh = record.get("Reserve Price Rs Lakh").toBigDecimalOrNull() ?: BigDecimal.ZERO
            val basePrice = reservePriceLakh.multiply(BigDecimal(100000))

            val now = Instant.now().toEpochMilli()

            val player = Player(
                id = UUID.randomUUID().toString(),
                name = name,
                country = country,
                age = age,
                specialism = specialism,
                battingStyle = battingStyle,
                bowlingStyle = bowlingStyle,
                testCaps = testCaps,
                odiCaps = odiCaps,
                t20Caps = t20Caps,
                basePrice = basePrice,
                isSold = false, // Dataset metadata ignored for game
                createdAt = now,
                updatedAt = now
            )

            playerRepository.save(player)
        }

        parser.close()
    }
}