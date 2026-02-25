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
    ): ResponseEntity<Auction> {
        return ResponseEntity.ok(auctionService.create(request))
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/status/{id}")
    fun updateStatus(
        @PathVariable id: String,
        @RequestBody request: UpdateAuctionStatusRequest
    ): ResponseEntity<Auction> {
        return ResponseEntity.ok(auctionService.updateStatus(id, request))
    }

    @GetMapping("/get/{id}")
    fun getById(@PathVariable id: String): ResponseEntity<Auction> {
        return ResponseEntity.ok(auctionService.getById(id))
    }

    @GetMapping("/list")
    fun list(): ResponseEntity<List<Auction>> {
        return ResponseEntity.ok(auctionService.list())
    }

    @GetMapping("/active")
    fun active(): ResponseEntity<Auction> {
        return ResponseEntity.of(
            Optional.ofNullable(auctionService.getActiveAuction())
        )
    }
}