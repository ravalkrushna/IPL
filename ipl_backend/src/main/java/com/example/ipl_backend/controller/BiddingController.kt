package com.example.ipl_backend.controller

import com.example.ipl_backend.dto.*
import com.example.ipl_backend.model.Bid
import com.example.ipl_backend.repository.WalletRepository
import com.example.ipl_backend.service.BiddingService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import java.math.BigDecimal
import java.util.UUID

@RestController
@RequestMapping("/api/v1/bidding")
class BiddingController(
    private val biddingService: BiddingService,
    private val walletRepository: WalletRepository
) {

    @PostMapping("/place")
    fun placeBid(
        @RequestBody request: PlaceBidRequest
    ): ResponseEntity<String> =
        ResponseEntity.ok(biddingService.placeBid(request))

    @GetMapping("/highest/{auctionId}/{playerId}")
    fun highestBid(
        @PathVariable auctionId: String,
        @PathVariable playerId: String
    ): ResponseEntity<HighestBidResponse> {
        val bid = biddingService.getCurrentHighestBid(playerId, auctionId)
        return ResponseEntity.ok(
            HighestBidResponse(
                playerId        = playerId,
                participantId   = bid?.participantId,
                participantName = null,
                amount          = bid?.amount ?: BigDecimal.ZERO,
                isManual        = bid?.isManual ?: false
            )
        )
    }

    @GetMapping("/history/{auctionId}/{playerId}")
    fun bidHistory(
        @PathVariable auctionId: String,
        @PathVariable playerId: String
    ): ResponseEntity<List<Bid>> =
        ResponseEntity.ok(biddingService.getBidHistory(playerId, auctionId))

    @GetMapping("/wallet/{participantId}/{auctionId}")
    fun getWallet(
        @PathVariable participantId: UUID,
        @PathVariable auctionId: String
    ): ResponseEntity<WalletResponse> {
        val wallet = walletRepository.findByParticipantAndAuction(participantId, auctionId)
            ?: return ResponseEntity.notFound().build()

        return ResponseEntity.ok(
            WalletResponse(
                id            = wallet.id,
                participantId = participantId,
                auctionId     = auctionId,
                balance       = wallet.balance
            )
        )
    }
}