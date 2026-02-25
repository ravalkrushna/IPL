package com.example.ipl_backend.service

import com.example.ipl_backend.dto.*
import com.example.ipl_backend.exception.InsufficientBalanceException
import com.example.ipl_backend.repository.*
import com.example.ipl_backend.model.*
import org.jetbrains.exposed.sql.transactions.transaction
import org.springframework.stereotype.Service
import java.time.Instant
import java.util.*
import java.math.BigDecimal


@Service
class BiddingService(
    private val bidRepository: BidRepository,
    private val walletRepository: WalletRepository,
    private val playerRepository: PlayerRepository,
    private val squadRepository: SquadRepository,
    private val auctionTimerService: AuctionTimerService,
    private val liveAuctionService: LiveAuctionService
) {

    fun placeBid(request: PlaceBidRequest): String {

        transaction {

            val player = playerRepository.findForUpdate(request.playerId)
                ?: throw RuntimeException("Player not found")

            if (player.isSold)   // ✅ CRITICAL GUARD
                throw RuntimeException("Player already sold")

            val wallet = walletRepository.findForUpdate(request.participantId)
                ?: throw RuntimeException("Wallet not found")

            if (wallet.balance < request.amount)
                throw InsufficientBalanceException()

            // ✅ CRITICAL FIX — validate against highest bid
            val highestBid = bidRepository.highestBidForUpdate(
                request.playerId,
                request.auctionId
            )

            if (highestBid != null && request.amount <= highestBid.amount) {
                throw RuntimeException("Bid must be higher than current bid")
            }

            val bid = Bid(
                id = UUID.randomUUID().toString(),
                auctionId = request.auctionId,
                playerId = request.playerId,
                participantId = request.participantId,
                amount = request.amount,
                createdAt = Instant.now().toEpochMilli()
            )

            bidRepository.save(bid)

            val squadName = squadRepository.findByParticipantAndAuction(
                request.participantId,
                request.auctionId
            )?.name ?: "Unknown"

            // ✅ ALWAYS restart timer
            auctionTimerService.resetTimer(
                request.playerId,
                request.auctionId
            )

            liveAuctionService.broadcastNewBid(
                request.playerId,
                request.participantId,
                request.amount,
                squadName
            )
        }

        return "Bid placed"
    }

    fun highestBid(playerId: String, auctionId: String): Bid? =
        bidRepository.findHighestBid(playerId, auctionId)

    fun history(playerId: String, auctionId: String): List<Bid> =
        bidRepository.findHistory(playerId, auctionId)

    fun passPlayer(request: PassPlayerRequest): String {

        transaction {

            val passes = auctionTimerService.getPassSet(request.playerId)

            if (!passes.add(request.participantId)) {
                throw RuntimeException("Already passed")
            }

            println("⛔ Participant passed → ${request.participantId}")

            liveAuctionService.broadcastMessage(
                request.playerId,
                "Participant passed"
            )

            auctionTimerService.checkIfEveryonePassed(
                request.playerId,
                request.auctionId
            )
        }

        return "Passed"
    }
}