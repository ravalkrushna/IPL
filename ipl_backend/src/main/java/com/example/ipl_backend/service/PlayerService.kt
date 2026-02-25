package com.example.ipl_backend.service

import com.example.ipl_backend.dto.CreatePlayerRequest
import com.example.ipl_backend.dto.ListPlayersRequest
import com.example.ipl_backend.model.Player
import com.example.ipl_backend.repository.PlayerRepository
import org.springframework.stereotype.Service
import java.time.Instant
import java.util.*

@Service
class PlayerService(
    private val playerRepository: PlayerRepository
) {

    fun create(request: CreatePlayerRequest): Player {

        if (playerRepository.existsByName(request.name)) {
            throw RuntimeException("Player with name ${request.name} already exists")
        }

        val now = Instant.now().toEpochMilli()

        val player = Player(
            id = UUID.randomUUID().toString(),
            name = request.name,
            country = request.country,
            age = request.age,
            specialism = request.specialism,
            battingStyle = request.battingStyle,
            bowlingStyle = request.bowlingStyle,
            testCaps = request.testCaps ?: 0,
            odiCaps = request.odiCaps ?: 0,
            t20Caps = request.t20Caps ?: 0,
            basePrice = request.basePrice,
            isSold = false,
            createdAt = now,
            updatedAt = now
        )

        playerRepository.save(player)

        return player
    }

    fun getById(id: String): Player {
        return playerRepository.findById(id)
            ?: throw RuntimeException("Player not found with id: $id")
    }
    fun list(request: ListPlayersRequest): List<Player> {

        val safeGetAll = request.getAll ?: false
        val safePage = request.page ?: 1
        val safeSize = request.size ?: 20

        val safeSpecialisms =
            if (request.specialisms.isNullOrEmpty()) null else request.specialisms

        val safeCountries =
            if (request.countries.isNullOrEmpty()) null else request.countries

        return playerRepository.findAll(
            request.search,
            safeSpecialisms,
            safeCountries,
            request.isSold,
            safeGetAll,
            safePage,
            safeSize
        )
    }

    fun getSoldPlayers(): List<Player> {
        return playerRepository.findSoldPlayers()
    }

    fun getUnsoldPlayers(): List<Player> {
        return playerRepository.findUnsoldPlayers()
    }
}