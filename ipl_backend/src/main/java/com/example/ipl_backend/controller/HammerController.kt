package com.example.ipl_backend.controller

import com.example.ipl_backend.dto.HammerRequest
import com.example.ipl_backend.dto.ManualHammerRequest
import com.example.ipl_backend.service.HammerService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1/hammer")
class HammerController(
    private val hammerService: HammerService
) {

    @PostMapping
    fun hammer(@RequestBody request: HammerRequest): ResponseEntity<Map<String, String>> {
        val result = hammerService.hammerToHighestBidder(request.playerId, request.auctionId)
        return ResponseEntity.ok(mapOf("message" to result))
    }

    @PostMapping("/manual")
    fun manualHammer(@RequestBody request: ManualHammerRequest): ResponseEntity<Map<String, String>> {
        require(request.participantId != null || !request.newParticipantName.isNullOrBlank()) {
            "Either participantId or newParticipantName must be provided"
        }
        val result = hammerService.hammerManual(
            playerId           = request.playerId,
            auctionId          = request.auctionId,
            participantId      = request.participantId,
            newParticipantName = request.newParticipantName?.trim(),
            finalAmount        = request.finalAmount
        )
        return ResponseEntity.ok(mapOf("message" to result))
    }
}