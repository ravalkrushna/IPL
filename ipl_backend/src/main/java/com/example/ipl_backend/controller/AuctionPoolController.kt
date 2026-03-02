package com.example.ipl_backend.controller

import com.example.ipl_backend.dto.ActivatePoolRequest
import com.example.ipl_backend.model.PoolType
import com.example.ipl_backend.service.AuctionPoolService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import java.util.UUID

@RestController
@RequestMapping("/api/v1/auctions/{auctionId}/pools")
class AuctionPoolController(
    private val auctionPoolService: AuctionPoolService
) {

    @GetMapping
    fun getPools(@PathVariable auctionId: String) =
        ResponseEntity.ok(auctionPoolService.getPoolsForAuction(auctionId))

    @GetMapping("/active")
    fun getActivePool(@PathVariable auctionId: String) =
        ResponseEntity.ok(auctionPoolService.getActivePool(auctionId))

    // AuctionPoolController.kt — already handles invalid enum gracefully
    @PostMapping("/activate")
    fun activatePool(
        @PathVariable auctionId: String,
        @RequestBody request: ActivatePoolRequest
    ): ResponseEntity<Any> {
        val poolType = try {
            PoolType.valueOf(request.poolType)
        } catch (_: IllegalArgumentException) {
            return ResponseEntity.badRequest().body(mapOf("error" to "Invalid pool type: ${request.poolType}"))
        }
        return try {
            ResponseEntity.ok(auctionPoolService.activatePool(auctionId, poolType))
        } catch (e: Exception) {
            ResponseEntity.badRequest().body(mapOf("error" to (e.message ?: "Cannot activate pool")))
        }
    }

    @PostMapping("/pause")
    fun pausePool(@PathVariable auctionId: String): ResponseEntity<Any> {
        return try {
            ResponseEntity.ok(auctionPoolService.pausePool(auctionId))
        } catch (e: Exception) {
            ResponseEntity.badRequest().body(mapOf("error" to (e.message ?: "Cannot pause pool")))
        }
    }

    @PostMapping("/complete")
    fun completePool(@PathVariable auctionId: String): ResponseEntity<Any> {
        return try {
            ResponseEntity.ok(auctionPoolService.completePool(auctionId))
        } catch (e: Exception) {
            ResponseEntity.badRequest().body(mapOf("error" to (e.message ?: "Cannot complete pool")))
        }
    }

    @DeleteMapping("/{poolId}")
    fun deletePool(
        @PathVariable auctionId: String,
        @PathVariable poolId: UUID
    ): ResponseEntity<Map<String, String>> {
        auctionPoolService.deletePool(poolId)
        return ResponseEntity.ok(mapOf("message" to "Pool deleted"))
    }
}