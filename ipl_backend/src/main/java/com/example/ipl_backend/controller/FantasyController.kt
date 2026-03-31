package com.example.ipl_backend.controller

import com.example.ipl_backend.service.FantasyService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1/fantasy")
class FantasyController(
    private val fantasyService: FantasyService
) {

    @GetMapping("/leaderboard/{auctionId}")
    fun getLeaderboard(
        @PathVariable auctionId: String,
        @RequestParam(name = "season", required = false, defaultValue = "2026") season: String
    ): ResponseEntity<Any> {
        val result = fantasyService.getLeaderboard(auctionId, season.trim())
        return ResponseEntity.ok(result)
    }

    @GetMapping("/squad/{squadId}")
    fun getSquadFantasy(
        @PathVariable squadId: String,
        @RequestParam(name = "season", required = false, defaultValue = "2026") season: String
    ): ResponseEntity<Any> {
        val result = fantasyService.getSquadFantasy(squadId, season.trim())
            ?: return ResponseEntity.notFound().build()
        return ResponseEntity.ok(result)
    }

    @GetMapping("/player/{playerId}")
    fun getPlayerFantasy(@PathVariable playerId: String): ResponseEntity<Any> {
        val result = fantasyService.getPlayerFantasy(playerId)
            ?: return ResponseEntity.notFound().build()
        return ResponseEntity.ok(result)
    }

    @GetMapping("/player/{playerId}/ipl-career")
    fun getIplCareer(@PathVariable playerId: String): ResponseEntity<Any> {
        val result = fantasyService.getIplCareer(playerId)
        return ResponseEntity.ok(result)
    }

    @GetMapping("/match/{matchId}")
    fun getMatchFantasy(@PathVariable matchId: String): ResponseEntity<Any> {
        val result = fantasyService.getMatchFantasy(matchId)
            ?: return ResponseEntity.notFound().build()
        return ResponseEntity.ok(result)
    }
}