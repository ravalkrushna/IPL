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

    @GetMapping("/squad/{squadId}/previous-squad")
    fun getPreviousSquad(@PathVariable squadId: String): ResponseEntity<Any> {
        val result = fantasyService.getSquadPreviousSquad(squadId)
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

    // Returns a playerId → squad name map for an auction at the time a match was
    // played. For matches earlier than the auction's mid-season lock, the
    // pre-mid-season snapshot is used; for matches at or after the lock the
    // current squad composition is used. Lets the IPL Matches view attribute
    // points to whichever squad actually owned the player at match time.
    @GetMapping("/match/{matchId}/squad-mapping/{auctionId}")
    fun getMatchSquadMapping(
        @PathVariable matchId: String,
        @PathVariable auctionId: String
    ): ResponseEntity<Any> {
        val mapping = fantasyService.getMatchSquadMapping(auctionId, matchId)
            ?: return ResponseEntity.notFound().build()
        return ResponseEntity.ok(mapping)
    }
}