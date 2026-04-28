package com.example.ipl_backend.controller

import com.example.ipl_backend.service.MidSeasonService
import com.example.ipl_backend.service.MidSeasonStatusResponse
import com.example.ipl_backend.model.MidSeasonRetention
import com.example.ipl_backend.model.Auction
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1/mid-season")
class MidSeasonController(
    private val midSeasonService: MidSeasonService
) {

    // GET /api/v1/mid-season/{auctionId}/status
    @GetMapping("/{auctionId}/status")
    fun getStatus(@PathVariable auctionId: String): ResponseEntity<MidSeasonStatusResponse> =
        ResponseEntity.ok(midSeasonService.getStatus(auctionId))

    // POST /api/v1/mid-season/{auctionId}/start
    @PostMapping("/{auctionId}/start")
    fun startRetentionPhase(@PathVariable auctionId: String): ResponseEntity<Auction> =
        ResponseEntity.ok(midSeasonService.startRetentionPhase(auctionId))

    // GET /api/v1/mid-season/{auctionId}/retentions
    @GetMapping("/{auctionId}/retentions")
    fun getRetentions(@PathVariable auctionId: String): ResponseEntity<List<MidSeasonRetention>> =
        ResponseEntity.ok(midSeasonService.getRetentions(auctionId))

    // GET /api/v1/mid-season/{auctionId}/squads/{squadId}/retentions
    @GetMapping("/{auctionId}/squads/{squadId}/retentions")
    fun getSquadRetentions(
        @PathVariable auctionId: String,
        @PathVariable squadId: String
    ): ResponseEntity<List<MidSeasonRetention>> =
        ResponseEntity.ok(midSeasonService.getSquadRetentions(auctionId, squadId))

    // POST /api/v1/mid-season/{auctionId}/squads/{squadId}/retain
    @PostMapping("/{auctionId}/squads/{squadId}/retain")
    fun addRetention(
        @PathVariable auctionId: String,
        @PathVariable squadId: String,
        @RequestBody body: RetainPlayerRequest
    ): ResponseEntity<MidSeasonRetention> =
        ResponseEntity.ok(midSeasonService.addRetention(auctionId, squadId, body.playerId))

    // DELETE /api/v1/mid-season/{auctionId}/squads/{squadId}/retain/{playerId}
    @DeleteMapping("/{auctionId}/squads/{squadId}/retain/{playerId}")
    fun removeRetention(
        @PathVariable auctionId: String,
        @PathVariable squadId: String,
        @PathVariable playerId: String
    ): ResponseEntity<Void> {
        midSeasonService.removeRetention(auctionId, squadId, playerId)
        return ResponseEntity.noContent().build()
    }

    // POST /api/v1/mid-season/{auctionId}/finalize
    @PostMapping("/{auctionId}/finalize")
    fun finalizeMidSeason(@PathVariable auctionId: String): ResponseEntity<Auction> =
        ResponseEntity.ok(midSeasonService.finalizeMidSeason(auctionId))
}

data class RetainPlayerRequest(val playerId: String)
