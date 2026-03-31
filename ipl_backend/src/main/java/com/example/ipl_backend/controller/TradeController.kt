package com.example.ipl_backend.controller

import com.example.ipl_backend.dto.CreateTradeRequest
import com.example.ipl_backend.dto.CreateSellListingRequest
import com.example.ipl_backend.dto.AcceptSellListingRequest
import com.example.ipl_backend.dto.CreateLoanRequest
import com.example.ipl_backend.dto.ApproveLoanRequest
import com.example.ipl_backend.dto.TradeResponse
import com.example.ipl_backend.service.TradeService
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1/trades")
class TradeController(
    private val tradeService: TradeService
) {
    @PreAuthorize("hasRole('ADMIN') or hasRole('PARTICIPANT')")
    @PostMapping
    fun create(@RequestBody request: CreateTradeRequest): ResponseEntity<TradeResponse> =
        ResponseEntity.ok(tradeService.createTrade(request))

    @PreAuthorize("hasRole('ADMIN') or hasRole('PARTICIPANT')")
    @PostMapping("/{tradeId}/accept")
    fun accept(@PathVariable tradeId: String): ResponseEntity<TradeResponse> =
        ResponseEntity.ok(tradeService.acceptTrade(tradeId))

    @PreAuthorize("hasRole('ADMIN') or hasRole('PARTICIPANT')")
    @PostMapping("/loan")
    fun createLoan(@RequestBody request: CreateLoanRequest): ResponseEntity<TradeResponse> =
        ResponseEntity.ok(tradeService.createLoan(request))

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/{tradeId}/approve-loan")
    fun approveLoan(
        @PathVariable tradeId: String,
        @RequestBody request: ApproveLoanRequest
    ): ResponseEntity<TradeResponse> =
        ResponseEntity.ok(tradeService.approveLoan(tradeId, request.borrowerSquadId))

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/{tradeId}/close-loan")
    fun closeLoan(@PathVariable tradeId: String): ResponseEntity<TradeResponse> =
        ResponseEntity.ok(tradeService.closeLoan(tradeId))

    @PreAuthorize("hasRole('ADMIN') or hasRole('PARTICIPANT')")
    @PostMapping("/sell-listing")
    fun createSellListing(@RequestBody request: CreateSellListingRequest): ResponseEntity<TradeResponse> =
        ResponseEntity.ok(tradeService.createSellListing(request))

    @PreAuthorize("hasRole('ADMIN') or hasRole('PARTICIPANT')")
    @PostMapping("/{tradeId}/accept-sell")
    fun acceptSellListing(
        @PathVariable tradeId: String,
        @RequestBody request: AcceptSellListingRequest
    ): ResponseEntity<TradeResponse> =
        ResponseEntity.ok(tradeService.acceptSellListing(tradeId, request.buyerSquadId))

    @PreAuthorize("hasRole('ADMIN') or hasRole('PARTICIPANT')")
    @PostMapping("/{tradeId}/reject")
    fun reject(@PathVariable tradeId: String): ResponseEntity<TradeResponse> =
        ResponseEntity.ok(tradeService.rejectTrade(tradeId))

    @PreAuthorize("hasRole('ADMIN') or hasRole('PARTICIPANT')")
    @PostMapping("/{tradeId}/cancel")
    fun cancel(@PathVariable tradeId: String): ResponseEntity<TradeResponse> =
        ResponseEntity.ok(tradeService.cancelTrade(tradeId))

    @PreAuthorize("hasRole('ADMIN') or hasRole('PARTICIPANT')")
    @GetMapping("/auction/{auctionId}")
    fun listByAuction(@PathVariable auctionId: String): ResponseEntity<List<TradeResponse>> =
        ResponseEntity.ok(tradeService.listByAuction(auctionId))
}

