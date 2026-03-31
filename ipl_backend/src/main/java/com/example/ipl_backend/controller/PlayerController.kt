package com.example.ipl_backend.controller

import com.example.ipl_backend.dto.CreatePlayerRequest
import com.example.ipl_backend.dto.ListPlayersRequest
import com.example.ipl_backend.dto.RenamePlayerNameRequest
import com.example.ipl_backend.model.Player
import com.example.ipl_backend.repository.PlayerRepository
import com.example.ipl_backend.service.PlayerService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1/players")
class PlayerController(
    private val playerService: PlayerService,
    private val playerRepository: PlayerRepository
) {

    @PostMapping("/create")
    fun create(@RequestBody request: CreatePlayerRequest): ResponseEntity<Player> {
        val player = playerService.create(request)
        return ResponseEntity.status(HttpStatus.CREATED).body(player)
    }

    @GetMapping("/get/{id}")
    fun getById(@PathVariable id: String): ResponseEntity<Player> {
        val player = playerService.getById(id)
        return ResponseEntity.ok(player)
    }

    @PostMapping("/list")
    fun list(@RequestBody request: ListPlayersRequest): ResponseEntity<List<Player>> {

        val players = playerService.list(request)   // 🚀 FIXED

        return ResponseEntity.ok(players)
    }

    @GetMapping("/sold")
    fun soldPlayers(): ResponseEntity<List<Player>> {
        return ResponseEntity.ok(playerService.getSoldPlayers())
    }

    @GetMapping("/unsold")
    fun unsoldPlayers(): ResponseEntity<List<Player>> {
        return ResponseEntity.ok(playerService.getUnsoldPlayers())
    }

    // In your PlayerController or a debug controller
    @GetMapping("/debug/players/auctioned-state")
    fun debugAuctionedState(): Map<String, Any> {
        val all = playerRepository.findAll()
        return mapOf(
            "total" to all.size,
            "isAuctioned_true" to all.count { it.isAuctioned },
            "isSold_true" to all.count { it.isSold },
            "unsold_auctioned_not_sold" to all.count { it.isAuctioned && !it.isSold }
        )
    }

    @PostMapping("/rename-name")
    fun renamePlayerName(@RequestBody request: RenamePlayerNameRequest): ResponseEntity<Map<String, Any>> {
        val from = request.fromName.trim()
        val to = request.toName.trim()
        if (from.isBlank() || to.isBlank()) {
            return ResponseEntity.badRequest().body(mapOf("error" to "fromName and toName are required"))
        }
        if (from.equals(to, ignoreCase = true)) {
            return ResponseEntity.badRequest().body(mapOf("error" to "fromName and toName are the same"))
        }
        if (playerRepository.existsByName(to)) {
            return ResponseEntity.badRequest().body(mapOf("error" to "A player with name '$to' already exists"))
        }

        val player = playerRepository.findByName(from)
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(mapOf("error" to "Player not found with name: $from"))

        playerRepository.update(player.copy(name = to))
        return ResponseEntity.ok(
            mapOf(
                "ok" to true,
                "message" to "Player renamed successfully",
                "playerId" to player.id,
                "fromName" to from,
                "toName" to to
            )
        )
    }
}