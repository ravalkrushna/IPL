package com.example.ipl_backend.controller

import com.example.ipl_backend.dto.*
import com.example.ipl_backend.model.Auction
import com.example.ipl_backend.service.AuctionService
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.*
import java.util.Optional

@RestController
@RequestMapping("/api/v1/auctions")
class AuctionController(
    private val auctionService: AuctionService
) {

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/create")
    fun create(
        @RequestBody request: CreateAuctionRequest
    ): ResponseEntity<Auction> =
        ResponseEntity.ok(auctionService.create(request))

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/status/{id}")
    fun updateStatus(
        @PathVariable id: String,
        @RequestBody request: UpdateAuctionStatusRequest
    ): ResponseEntity<Auction> =
        ResponseEntity.ok(auctionService.updateStatus(id, request))

    /** Pause a live auction — freezes the countdown timer. */
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}/pause")
    fun pause(@PathVariable id: String): ResponseEntity<Auction> =
        ResponseEntity.ok(auctionService.pause(id))

    /** Resume a paused auction — restarts the countdown. */
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}/resume")
    fun resume(@PathVariable id: String): ResponseEntity<Auction> =
        ResponseEntity.ok(auctionService.resume(id))

    /** End the auction immediately — marks as COMPLETED. */
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}/end")
    fun end(@PathVariable id: String): ResponseEntity<Auction> =
        ResponseEntity.ok(auctionService.end(id))

    @GetMapping("/get/{id}")
    fun getById(@PathVariable id: String): ResponseEntity<Auction> =
        ResponseEntity.ok(auctionService.getById(id))

    @GetMapping("/list")
    fun list(): ResponseEntity<List<Auction>> =
        ResponseEntity.ok(auctionService.list())

    @GetMapping("/active")
    fun active(): ResponseEntity<Auction> =
        ResponseEntity.of(Optional.ofNullable(auctionService.getActiveAuction()))
}