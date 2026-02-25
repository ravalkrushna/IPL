package com.example.ipl_backend.controller

import com.example.ipl_backend.dto.*
import com.example.ipl_backend.model.Player
import com.example.ipl_backend.service.AuctionDashboardService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import java.util.UUID

@RestController
@RequestMapping("/api/v1/dashboard")
class AuctionDashboardController(
    private val dashboardService: AuctionDashboardService
) {

    @GetMapping("/players/sold")
    fun soldPlayers(): ResponseEntity<List<Player>> =
        ResponseEntity.ok(dashboardService.soldPlayers())

    @GetMapping("/players/unsold")
    fun unsoldPlayers(): ResponseEntity<List<Player>> =
        ResponseEntity.ok(dashboardService.unsoldPlayers())

    @GetMapping("/wallet/leaderboard")
    fun leaderboard(): ResponseEntity<List<WalletLeaderboardResponse>> =
        ResponseEntity.ok(dashboardService.walletLeaderboard())

    @GetMapping("/participant/{participantId}/auction/{auctionId}")
    fun participantProfile(
        @PathVariable participantId: UUID,   // ✅ FIXED
        @PathVariable auctionId: String
    ): ResponseEntity<ParticipantProfileResponse> {

        return ResponseEntity.ok(
            dashboardService.participantProfile(participantId, auctionId)
        )
    }
}