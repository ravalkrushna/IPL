package com.example.ipl_backend.service

import com.example.ipl_backend.dto.PlaceBidRequest
import com.example.ipl_backend.exception.InsufficientBalanceException
import com.example.ipl_backend.model.Bid
import com.example.ipl_backend.model.BidType
import com.example.ipl_backend.repository.*
import org.jetbrains.exposed.sql.transactions.transaction
import org.springframework.stereotype.Service
import java.time.Instant
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.locks.ReentrantLock

@Service
class BiddingService(
    private val bidRepository: BidRepository,
    private val walletRepository: WalletRepository,
    private val playerRepository: PlayerRepository,
    private val squadRepository: SquadRepository,
    private val participantRepository: ParticipantRepository,
    private val auctionRepository: AuctionRepository,
    private val auctionEngineService: AuctionEngineService,
    private val bidLogService: BidLogService
) {

    // One lock per auction — serialises all bids within an auction
    private val auctionLocks = ConcurrentHashMap<String, ReentrantLock>()

    private fun lockFor(auctionId: String): ReentrantLock =
        auctionLocks.computeIfAbsent(auctionId) { ReentrantLock() }

    fun placeBid(request: PlaceBidRequest): String {
        val lock = lockFor(request.auctionId)
        lock.lock()
        try {
            return doPlaceBid(request)
        } finally {
            lock.unlock()
        }
    }

    private fun doPlaceBid(request: PlaceBidRequest): String = transaction {

        // ── 1. Bidding gate ──────────────────────────────────────────────
        if (!auctionEngineService.isBiddingOpen(request.auctionId)) {
            throw RuntimeException("Bidding is not open yet — wait for analysis timer to finish")
        }

        // ── 2. Player must exist and not yet sold ────────────────────────
        val player = playerRepository.findForUpdate(request.playerId)
            ?: throw RuntimeException("Player not found")

        if (player.isSold) throw RuntimeException("Player already sold")
        if (player.isAuctioned) throw RuntimeException("Player already auctioned")

        // ── 3. Player must be the CURRENT player for this auction ────────
        val currentPlayer = auctionEngineService.getCurrentPlayer(request.auctionId)
        if (currentPlayer?.id != request.playerId) {
            throw RuntimeException("This player is not currently up for auction")
        }

        // ── 4. Auction settings ──────────────────────────────────────────
        val auction = auctionRepository.findById(request.auctionId)
            ?: throw RuntimeException("Auction not found")

        // ── 5. Highest bid checks ────────────────────────────────────────
        val highestBid = bidRepository.highestBidForUpdate(request.playerId, request.auctionId)

        if (highestBid != null && highestBid.participantId == request.participantId) {
            throw RuntimeException("You already have the highest bid — wait for someone else to bid")
        }

        if (highestBid != null && request.amount <= highestBid.amount) {
            throw RuntimeException("Bid must be higher than current highest bid of ${highestBid.amount}")
        }

        if (highestBid == null && request.amount < player.basePrice) {
            throw RuntimeException("Bid must be at least the base price of ${player.basePrice}")
        }

        if (highestBid != null) {
            val minRequired = highestBid.amount + auction.minBidIncrement
            if (request.amount < minRequired) {
                throw RuntimeException("Minimum bid increment is ${auction.minBidIncrement}. Next minimum bid: $minRequired")
            }
        }

        // ── 6. Wallet check ──────────────────────────────────────────────
        val wallet = walletRepository.findForUpdate(request.participantId, request.auctionId)
            ?: throw RuntimeException("Wallet not found for this auction")

        if (wallet.balance < request.amount) throw InsufficientBalanceException()

        // ── 7. Participant info ──────────────────────────────────────────
        val participant = participantRepository.findById(request.participantId)
            ?: throw RuntimeException("Participant not found")

        val squad = squadRepository.findByParticipantAndAuction(request.participantId, request.auctionId)
        val squadName = squad?.name ?: participant.name

        // ── 8. Save bid ──────────────────────────────────────────────────
        val bid = Bid(
            id            = UUID.randomUUID().toString(),
            auctionId     = request.auctionId,
            playerId      = request.playerId,
            participantId = request.participantId,
            amount        = request.amount,
            isManual      = false,
            createdAt     = Instant.now().toEpochMilli()
        )
        bidRepository.save(bid)

        // ── 9. Audit log ─────────────────────────────────────────────────
        bidLogService.logBid(
            auctionId       = request.auctionId,
            playerId        = request.playerId,
            participantId   = request.participantId,
            participantName = participant.name,
            squadName       = squadName,
            amount          = request.amount,
            bidType         = BidType.ONLINE_BID
        )

        // No SSE broadcast — frontend polls /engine/state + /bids/highest
        "Bid placed successfully"
    }

    fun getCurrentHighestBid(playerId: String, auctionId: String): Bid? =
        bidRepository.findHighestBid(playerId, auctionId)

    fun getBidHistory(playerId: String, auctionId: String): List<Bid> =
        bidRepository.findHistory(playerId, auctionId)

    fun passPlayer(request: com.example.ipl_backend.dto.PassPlayerRequest): String {
        bidLogService.logBid(
            auctionId     = request.auctionId,
            playerId      = request.playerId,
            participantId = request.participantId,
            bidType       = com.example.ipl_backend.model.BidType.PLAYER_PASSED
        )
        return "Passed"
    }
}