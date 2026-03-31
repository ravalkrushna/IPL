package com.example.ipl_backend.controller

import com.example.ipl_backend.dto.*
import com.example.ipl_backend.model.Auction
import com.example.ipl_backend.model.AuctionStatus
import com.example.ipl_backend.service.AuctionService
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1/auctions")
class AuctionController(
    private val auctionService: AuctionService
) {

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/create")
    fun create(@RequestBody request: CreateAuctionRequest): ResponseEntity<Auction> =
        ResponseEntity.ok(auctionService.create(request))

    @GetMapping("/get/{id}")
    fun getById(@PathVariable id: String): ResponseEntity<Auction> =
        ResponseEntity.ok(auctionService.getById(id))

    @GetMapping("/list")
    fun list(): ResponseEntity<List<Auction>> =
        ResponseEntity.ok(auctionService.list())

    // Active auctions (multiple can run simultaneously now)
    @GetMapping("/active")
    fun activeAuctions(): ResponseEntity<List<Auction>> =
        ResponseEntity.ok(auctionService.list().filter { it.status == AuctionStatus.LIVE })

    // ── Status transitions ────────────────────────────────────────────

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/status/{id}")
    fun updateStatus(
        @PathVariable id: String,
        @RequestBody request: UpdateAuctionStatusRequest
    ): ResponseEntity<Auction> =
        ResponseEntity.ok(auctionService.updateStatus(id, request.status))

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}/pause")
    fun pause(@PathVariable id: String): ResponseEntity<Auction> =
        ResponseEntity.ok(auctionService.pause(id))

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}/resume")
    fun resume(@PathVariable id: String): ResponseEntity<Auction> =
        ResponseEntity.ok(auctionService.resume(id))

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}/end")
    fun end(@PathVariable id: String): ResponseEntity<Auction> =
        ResponseEntity.ok(auctionService.end(id))

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}/reauction/start")
    fun startReauction(@PathVariable id: String): ResponseEntity<Auction> =
        ResponseEntity.ok(auctionService.startReauction(id))

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}")
    fun update(
        @PathVariable id: String,
        @RequestBody request: UpdateAuctionRequest
    ): ResponseEntity<Auction> =
        ResponseEntity.ok(auctionService.update(id, request))

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    fun delete(@PathVariable id: String): ResponseEntity<Map<String, String>> {
        auctionService.delete(id)
        return ResponseEntity.ok(mapOf("message" to "Auction deleted"))
    }
}