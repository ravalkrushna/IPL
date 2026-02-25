package com.example.ipl_backend.controller

import com.example.ipl_backend.dto.*
import com.example.ipl_backend.model.Squad
import com.example.ipl_backend.service.SquadService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import java.util.UUID

@RestController
@RequestMapping("/api/v1/squads")
class SquadController(
    private val squadService: SquadService
) {


    @PostMapping("/create")
    fun create(
        @RequestBody request: CreateSquadRequest
    ): ResponseEntity<Squad> {
        return ResponseEntity.ok(squadService.create(request))
    }

    @GetMapping("/get/{id}")
    fun getSquad(
        @PathVariable id: String
    ): ResponseEntity<SquadResponse> {
        return ResponseEntity.ok(squadService.getSquad(id))
    }

    @GetMapping("/my/{auctionId}")
    fun mySquad(
        @PathVariable auctionId: String,
        @RequestParam participantId: UUID
    ): ResponseEntity<MySquadResponse> {

        val response = squadService.findMySquadWithPlayers(participantId, auctionId)
            ?: return ResponseEntity.notFound().build()

        return ResponseEntity.ok(response)
    }
}