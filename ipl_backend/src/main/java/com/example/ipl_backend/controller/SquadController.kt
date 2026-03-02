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
    fun create(@RequestBody request: CreateSquadRequest): ResponseEntity<Squad> =
        ResponseEntity.ok(squadService.create(request))

    @GetMapping("/get/{id}")
    fun getSquad(@PathVariable id: String): ResponseEntity<SquadResponse> =
        ResponseEntity.ok(squadService.getSquad(id))

    @GetMapping("/my/{auctionId}")
    fun mySquad(
        @PathVariable auctionId: String,
        @RequestParam participantId: UUID
    ): ResponseEntity<MySquadResponse> {
        val response = squadService.findMySquadWithPlayers(participantId, auctionId)
            ?: return ResponseEntity.notFound().build()
        return ResponseEntity.ok(response)
    }

    @GetMapping("/all/{auctionId}")
    fun allSquads(@PathVariable auctionId: String): ResponseEntity<List<MySquadResponse>> =
        ResponseEntity.ok(squadService.findAllSquadsWithPlayers(auctionId))

    @PutMapping("/{id}")
    fun update(
        @PathVariable id: String,
        @RequestBody request: Map<String, String>
    ): ResponseEntity<Map<String, String>> {
        val name = request["name"] ?: return ResponseEntity.badRequest()
            .body(mapOf("error" to "name is required"))
        squadService.update(id, name)
        return ResponseEntity.ok(mapOf("message" to "Squad updated"))
    }

    @DeleteMapping("/{id}")
    fun delete(@PathVariable id: String): ResponseEntity<Map<String, String>> {
        squadService.delete(id)
        return ResponseEntity.ok(mapOf("message" to "Squad deleted"))
    }
}