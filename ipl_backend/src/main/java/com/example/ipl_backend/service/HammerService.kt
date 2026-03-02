package com.example.ipl_backend.service

import com.example.ipl_backend.exception.InvalidAuctionStateException
import com.example.ipl_backend.model.Bid
import com.example.ipl_backend.model.BidType
import com.example.ipl_backend.repository.*
import org.jetbrains.exposed.sql.transactions.transaction
import org.springframework.stereotype.Service
import java.math.BigDecimal
import java.time.Instant
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

@Service
class HammerService(
    private val bidRepository: BidRepository,
    private val walletRepository: WalletRepository,
    private val squadRepository: SquadRepository,
    private val playerRepository: PlayerRepository,
    private val participantRepository: ParticipantRepository,
    private val auctionRepository: AuctionRepository,
    private val auctionEngineService: AuctionEngineService,
    private val auctionTimerService: AuctionTimerService,
    private val bidLogService: BidLogService
) {

    // Idempotency guard — prevents double hammer
    private val hammering = ConcurrentHashMap.newKeySet<String>()

    /**
     * MODE 1 — Auto Hammer
     * Awards player to whoever holds the highest online bid.
     */
    fun hammerToHighestBidder(playerId: String, auctionId: String): String {
        if (!hammering.add(playerId)) return "Already hammering"
        try {
            transaction {
                val player = playerRepository.findForUpdate(playerId)
                if (player?.isAuctioned == true) return@transaction

                auctionTimerService.cancelTimer(playerId)

                val highestBid = bidRepository.highestBidForUpdate(playerId, auctionId)

                if (highestBid == null) {
                    markUnsold(playerId, auctionId)
                    return@transaction
                }

                awardPlayer(
                    playerId      = playerId,
                    auctionId     = auctionId,
                    participantId = highestBid.participantId,
                    finalAmount   = highestBid.amount,
                    isManual      = false
                )
            }
        } finally {
            hammering.remove(playerId)
        }
        return "Player hammered to highest bidder"
    }

    /**
     * MODE 2 — Manual Hammer
     * Admin types final amount + selects participant.
     */
    fun hammerManual(
        playerId: String,
        auctionId: String,
        participantId: UUID,
        finalAmount: BigDecimal
    ): String {
        if (!hammering.add(playerId)) return "Already hammering"
        try {
            transaction {
                val player = playerRepository.findForUpdate(playerId)
                if (player?.isAuctioned == true) {
                    throw InvalidAuctionStateException("Player already auctioned")
                }

                if (finalAmount <= BigDecimal.ZERO) {
                    throw IllegalArgumentException("Final amount must be greater than zero")
                }

                auctionTimerService.cancelTimer(playerId)

                participantRepository.findById(participantId)
                    ?: throw RuntimeException("Participant not found")

                val manualBid = Bid(
                    id            = UUID.randomUUID().toString(),
                    auctionId     = auctionId,
                    playerId      = playerId,
                    participantId = participantId,
                    amount        = finalAmount,
                    isManual      = true,
                    createdAt     = Instant.now().toEpochMilli()
                )
                bidRepository.save(manualBid)

                awardPlayer(
                    playerId      = playerId,
                    auctionId     = auctionId,
                    participantId = participantId,
                    finalAmount   = finalAmount,
                    isManual      = true
                )
            }
        } finally {
            hammering.remove(playerId)
        }
        return "Player manually hammered"
    }

    // ── Private helpers ──────────────────────────────────────────────────

    private fun awardPlayer(
        playerId: String,
        auctionId: String,
        participantId: UUID,
        finalAmount: BigDecimal,
        isManual: Boolean
    ) {
        val wallet = walletRepository.findForUpdate(participantId, auctionId)
            ?: run {
                markUnsold(playerId, auctionId)
                throw RuntimeException("Wallet not found for participant in this auction")
            }

        if (wallet.balance < finalAmount) {
            markUnsold(playerId, auctionId)
            throw RuntimeException("Insufficient balance — player marked unsold")
        }

        val squad = squadRepository.findForUpdate(participantId, auctionId)
            ?: run {
                markUnsold(playerId, auctionId)
                throw RuntimeException("Squad not found — player marked unsold")
            }

        val participant = participantRepository.findById(participantId)!!
        val playerObj   = playerRepository.findById(playerId)

        // Deduct wallet
        walletRepository.decrementBalance(participantId, auctionId, finalAmount)

        // Add to squad
        squadRepository.addPlayer(squad.id, playerId, finalAmount)

        // Mark player sold
        playerRepository.markAsSold(playerId)

        // Clear engine state
        auctionEngineService.clearCurrentPlayer(auctionId)

        // Store result for frontend polling — replaces SSE PLAYER_SOLD broadcast
        auctionEngineService.setLastResult(
            auctionId,
            AuctionEngineService.LastResult(
                playerName = playerObj?.name ?: playerId,
                squadName  = squad.name,
                amount     = finalAmount,
                unsold     = false
            )
        )

        // Audit log
        bidLogService.logBid(
            auctionId       = auctionId,
            playerId        = playerId,
            participantId   = participantId,
            participantName = participant.name,
            squadName       = squad.name,
            amount          = finalAmount,
            bidType         = if (isManual) BidType.MANUAL_HAMMER else BidType.AUTO_HAMMER
        )

        println("🔨 Player $playerId SOLD → ${participant.name} for $finalAmount (manual=$isManual)")
    }

    private fun markUnsold(playerId: String, auctionId: String) {
        playerRepository.markAsUnsold(playerId)
        auctionEngineService.clearCurrentPlayer(auctionId)

        val playerObj = playerRepository.findById(playerId)

        // Store unsold result for frontend polling — replaces SSE PLAYER_UNSOLD broadcast
        auctionEngineService.setLastResult(
            auctionId,
            AuctionEngineService.LastResult(
                playerName = playerObj?.name ?: playerId,
                squadName  = null,
                amount     = null,
                unsold     = true
            )
        )

        bidLogService.logBid(
            auctionId = auctionId,
            playerId  = playerId,
            bidType   = BidType.PLAYER_UNSOLD
        )
        println("⚠️ Player $playerId UNSOLD")
    }

    /**
     * MODE 2 — Manual Hammer
     * Admin types final amount + selects existing participant OR provides a new name.
     * If newParticipantName is given: creates participant, wallet (100Cr), and squad on the fly.
     */
    fun hammerManual(
        playerId: String,
        auctionId: String,
        participantId: UUID?,
        newParticipantName: String?,
        finalAmount: BigDecimal
    ): String {
        if (!hammering.add(playerId)) return "Already hammering"
        try {
            transaction {
                val player = playerRepository.findForUpdate(playerId)
                if (player?.isAuctioned == true) {
                    throw InvalidAuctionStateException("Player already auctioned")
                }

                if (finalAmount <= BigDecimal.ZERO) {
                    throw IllegalArgumentException("Final amount must be greater than zero")
                }

                auctionTimerService.cancelTimer(playerId)

                // ── Resolve participant — existing or brand new ──
                val resolvedParticipantId: UUID = when {

                    // New participant path
                    !newParticipantName.isNullOrBlank() -> {
                        val now = Instant.now().toEpochMilli()
                        val newId = UUID.randomUUID()

                        // 1. Create participant (userId reuses the UUID — offline participant has no auth user)
                        participantRepository.save(
                            com.example.ipl_backend.model.Participant(
                                id        = newId,
                                userId    = null,   // sentinel: no real user account
                                name      = newParticipantName,
                                createdAt = now,
                                updatedAt = now
                            )
                        )

                        // 2. Create wallet with the standard 100Cr starting balance
                        walletRepository.createForAllParticipants(auctionId, listOf(newId))

                        // 3. Create squad with the same name as the participant
                        squadRepository.save(
                            com.example.ipl_backend.model.Squad(
                                id            = UUID.randomUUID().toString(),
                                participantId = newId,
                                auctionId     = auctionId,
                                name          = newParticipantName,
                                createdAt     = now
                            )
                        )

                        newId
                    }

                    // Existing participant path
                    participantId != null -> {
                        participantRepository.findById(participantId)
                            ?: throw RuntimeException("Participant not found")
                        participantId
                    }

                    else -> throw IllegalArgumentException("Either participantId or newParticipantName must be provided")
                }

                // Record a manual bid entry for the audit trail
                val manualBid = Bid(
                    id            = UUID.randomUUID().toString(),
                    auctionId     = auctionId,
                    playerId      = playerId,
                    participantId = resolvedParticipantId,
                    amount        = finalAmount,
                    isManual      = true,
                    createdAt     = Instant.now().toEpochMilli()
                )
                bidRepository.save(manualBid)

                awardPlayer(
                    playerId      = playerId,
                    auctionId     = auctionId,
                    participantId = resolvedParticipantId,
                    finalAmount   = finalAmount,
                    isManual      = true
                )
            }
        } finally {
            hammering.remove(playerId)
        }
        return "Player manually hammered"
    }
}