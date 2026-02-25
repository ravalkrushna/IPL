package com.example.ipl_backend.service

import com.example.ipl_backend.exception.*
import com.example.ipl_backend.repository.*
import com.example.ipl_backend.model.*
import org.jetbrains.exposed.sql.transactions.transaction
import org.springframework.stereotype.Service
import java.util.concurrent.ConcurrentHashMap


@Service
class HammerService(
    private val bidRepository: BidRepository,
    private val walletRepository: WalletRepository,
    private val squadRepository: SquadRepository,
    private val playerRepository: PlayerRepository,
    private val auctionEngineService: AuctionEngineService,
    private val liveAuctionService: LiveAuctionService
) {

    // Tracks player IDs that are currently being hammered.
    // Prevents double-hammer when both the 10s timer AND checkIfEveryonePassed
    // fire at nearly the same time for the same player.
    private val hammering = ConcurrentHashMap.newKeySet<String>()

    fun hammerPlayer(playerId: String, auctionId: String): String {

        // ✅ If already being hammered, skip silently — idempotency guard
        if (!hammering.add(playerId)) {
            println("⚠️ hammerPlayer called twice for $playerId — skipping duplicate")
            return "Already hammering"
        }
        println("🔨 hammerPlayer started for $playerId (hammering set size: ${hammering.size})")

        try {
            transaction {

                // ✅ Re-read the player inside the transaction to get its REAL
                //    current state from DB — not stale in-memory state.
                //    This is the definitive idempotency check — if isAuctioned
                //    is true, another hammer already completed successfully.
                val player = playerRepository.findForUpdate(playerId)

                if (player?.isAuctioned == true) {
                    println("⚠️ Player $playerId already auctioned — skipping hammer")
                    return@transaction
                }

                val highestBid = bidRepository.highestBidForUpdate(playerId, auctionId)

                if (highestBid == null) {
                    println("⚠ No bids → PLAYER UNSOLD")
                    playerRepository.markAsUnsold(playerId)   // sets isAuctioned = true
                    auctionEngineService.loadNextPlayer(auctionId)
                    liveAuctionService.broadcastMessage(playerId, "PLAYER_UNSOLD")
                    return@transaction
                }

                val wallet = walletRepository.findForUpdate(highestBid.participantId)
                val squad = if (wallet != null) {
                    squadRepository.findForUpdate(highestBid.participantId, auctionId)
                } else null

                val canAfford = wallet != null &&
                        squad != null &&
                        wallet.balance >= highestBid.amount

                if (!canAfford) {
                    // ✅ Highest bidder can't pay (insufficient balance or no wallet/squad)
                    // Treat as unsold — mark auctioned so they don't requeue, advance to next
                    println("⚠️ Highest bidder ${highestBid.participantId} cannot pay " +
                            "(balance: ${wallet?.balance}, bid: ${highestBid.amount}) → UNSOLD")
                    playerRepository.markAsUnsold(playerId)
                    auctionEngineService.loadNextPlayer(auctionId)
                    liveAuctionService.broadcastMessage(playerId, "PLAYER_UNSOLD")
                    return@transaction
                }

                walletRepository.decrementBalance(
                    highestBid.participantId,
                    highestBid.amount
                )

                squadRepository.addPlayer(
                    squad!!.id,
                    playerId,
                    highestBid.amount
                )

                playerRepository.markAsSold(playerId)
                auctionEngineService.loadNextPlayer(auctionId)

                liveAuctionService.broadcastPlayerSold(
                    playerId,
                    highestBid.participantId,
                    highestBid.amount,
                    squad.name
                )

                val updatedWallet = walletRepository.findForUpdate(highestBid.participantId)
                if (updatedWallet != null) {
                    liveAuctionService.broadcastWalletUpdate(
                        highestBid.participantId,
                        updatedWallet.balance
                    )
                }
            }
        } finally {
            val removed = hammering.remove(playerId)
            println("🔓 hammerPlayer finished for $playerId — lock released: $removed")
        }

        return "Player hammered"
    }
}