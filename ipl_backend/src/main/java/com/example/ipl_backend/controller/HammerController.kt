package com.example.ipl_backend.controller

import com.example.ipl_backend.dto.*
import com.example.ipl_backend.service.HammerService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1/hammer")
class HammerController(
    private val hammerService: HammerService
) {

    @PostMapping("/player")
    fun hammerPlayer(
        @RequestBody request: HammerPlayerRequest
    ): ResponseEntity<String> {

        return ResponseEntity.ok(
            hammerService.hammerPlayer(
                request.playerId,
                request.auctionId
            )
        )
    }
}