package com.example.ipl_backend.controller

import com.example.ipl_backend.service.AuctionEngineService
import com.example.ipl_backend.service.AuctionPoolService
import com.example.ipl_backend.service.AuctionTimerService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1/auctions/{auctionId}/engine")
class AuctionEngineController(
    private val auctionEngineService: AuctionEngineService,
    private val auctionPoolService: AuctionPoolService,
    private val auctionTimerService: AuctionTimerService
) {

    @PostMapping("/next-player")
    fun nextPlayer(@PathVariable auctionId: String): ResponseEntity<Map<String, Any?>> {
        return try {
            auctionEngineService.loadNextPlayer(auctionId)
            val current = auctionEngineService.getCurrentPlayer(auctionId)
            ResponseEntity.ok<Map<String, Any?>>(mapOf(
                "message"       to "Next player loaded",
                "currentPlayer" to current,
                "biddingOpen"   to auctionEngineService.isBiddingOpen(auctionId)
            ))
        } catch (e: Exception) {
            ResponseEntity.badRequest().body(mapOf("error" to (e.message ?: "Cannot load next player")))
        }
    }

    @PostMapping("/start-analysis")
    fun startAnalysis(@PathVariable auctionId: String): ResponseEntity<Map<String, Any?>> {
        return try {
            auctionEngineService.startAnalysisTimer(auctionId)
            ResponseEntity.ok(mapOf("message" to "Analysis timer started") as Map<String, Any?>)
        } catch (e: Exception) {
            ResponseEntity.badRequest().body(mapOf("error" to (e.message ?: "Cannot start analysis")))
        }
    }

    @GetMapping("/last-result")
    fun getLastResult(@PathVariable auctionId: String): ResponseEntity<Map<String, Any?>> {
        val result = auctionEngineService.getLastResult(auctionId)
        val response: Map<String, Any?> = if (result != null) mapOf(
            "playerName" to result.playerName,
            "squadName"  to result.squadName,
            "amount"     to result.amount,
            "unsold"     to result.unsold,
            "timestamp"  to result.timestamp
        ) else mapOf("result" to null)
        return ResponseEntity.ok(response)
    }

    @GetMapping("/state")
    fun getState(@PathVariable auctionId: String): ResponseEntity<Map<String, Any?>> {
        val currentPlayer     = auctionEngineService.getCurrentPlayer(auctionId)
        val biddingOpen       = auctionEngineService.isBiddingOpen(auctionId)
        val lastResult        = auctionEngineService.getLastResult(auctionId)
        val poolExhausted     = auctionEngineService.isPoolExhausted(auctionId)
        val activePool        = auctionPoolService.getActivePool(auctionId)
        val allPools          = auctionPoolService.getPoolsForAuction(auctionId)
        val analysisSeconds   = currentPlayer?.let { auctionTimerService.getSecondsRemaining(it.id) } ?: 0
        val analysisTotalSecs = currentPlayer?.let { auctionTimerService.getTotalSecs(it.id) } ?: 0
        val upcomingPlayers   = auctionEngineService.getUpcomingPlayers(auctionId) // ← ADD

        val response: Map<String, Any?> = mapOf(
            "currentPlayer"     to currentPlayer,
            "biddingOpen"       to biddingOpen,
            "analysisSeconds"   to analysisSeconds,
            "analysisTotalSecs" to analysisTotalSecs,
            "activePool"        to activePool?.poolType?.name,
            "pools"             to allPools,
            "lastResult"        to lastResult,
            "poolExhausted"     to poolExhausted,
            "upcomingPlayers"   to upcomingPlayers  // ← ADD
        )
        return ResponseEntity.ok(response)
    }
}