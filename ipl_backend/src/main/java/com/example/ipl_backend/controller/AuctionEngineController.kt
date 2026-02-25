package com.example.ipl_backend.controller

import com.example.ipl_backend.model.Player
import com.example.ipl_backend.service.AuctionEngineService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.util.Optional

@RestController
@RequestMapping("/api/v1/auction-engine")
class AuctionEngineController(
    private val auctionEngineService: AuctionEngineService
) {

    @GetMapping("/current-player/{auctionId}")
    fun currentPlayer(
        @PathVariable auctionId: String
    ): ResponseEntity<Player> {

        return ResponseEntity.of(
            Optional.ofNullable(
                auctionEngineService.getCurrentPlayer(auctionId)
            )
        )
    }
}