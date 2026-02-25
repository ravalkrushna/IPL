package com.example.ipl_backend.controller

import com.example.ipl_backend.dto.CreatePlayerRequest
import com.example.ipl_backend.dto.ListPlayersRequest
import com.example.ipl_backend.model.Player
import com.example.ipl_backend.service.PlayerService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1/players")
class PlayerController(
    private val playerService: PlayerService
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
}