package com.example.ipl_backend.service

import com.example.ipl_backend.exception.InvalidAuctionStateException
import com.example.ipl_backend.model.Bid
import com.example.ipl_backend.model.BidType
import com.example.ipl_backend.model.Participant
import com.example.ipl_backend.model.Squad
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
    private val auctionEngineService: AuctionEngineService,
    private val auctionTimerService: AuctionTimerService,
    private val bidLogService: BidLogService
) {

    companion object {
        const val MAX_SQUAD_SIZE = 16
    }

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

                // ── Squad size check before awarding ──
                val winnerSquad = squadRepository.findForUpdate(highestBid.participantId, auctionId)
                if (winnerSquad != null) {
                    val squadPlayerCount = squadRepository.countPlayers(winnerSquad.id)
                    if (squadPlayerCount >= MAX_SQUAD_SIZE) {
                        println("⚠️ Squad ${winnerSquad.name} is full ($MAX_SQUAD_SIZE players) — marking player unsold")
                        markUnsold(playerId, auctionId)
                        return@transaction
                    }
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

                    // New participant path — new squad starts at 0 players, always safe
                    !newParticipantName.isNullOrBlank() -> {
                        val now = Instant.now().toEpochMilli()
                        val newId = UUID.randomUUID()

                        participantRepository.save(
                            Participant(
                                id        = newId,
                                userId    = null,
                                name      = newParticipantName,
                                createdAt = now,
                                updatedAt = now
                            )
                        )

                        walletRepository.createForAllParticipants(auctionId, listOf(newId))

                        squadRepository.save(
                            Squad(
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

                // ── Squad size check for existing squads ──
                val targetSquad = squadRepository.findForUpdate(resolvedParticipantId, auctionId)
                if (targetSquad != null) {
                    val squadPlayerCount = squadRepository.countPlayers(targetSquad.id)
                    if (squadPlayerCount >= MAX_SQUAD_SIZE) {
                        throw InvalidAuctionStateException(
                            "Squad '${targetSquad.name}' is full — cannot exceed $MAX_SQUAD_SIZE players"
                        )
                    }
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

    // ── Private helpers ──────────────────────────────────────────────────

    private fun awardPlayer(
        playerId: String,
        auctionId: String,
        participantId: UUID,
        finalAmount: BigDecimal,
        isManual: Boolean
    ) {
        // Guard: check across ALL squads in this auction — prevents double-sale
        if (squadRepository.isPlayerAlreadySoldInAuction(playerId, auctionId)) {
            println("⚠️ Player $playerId already sold in auction $auctionId — aborting duplicate hammer")
            return
        }

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

        // ── Final squad size guard (defensive — catches race conditions) ──
        val squadPlayerCount = squadRepository.countPlayers(squad.id)
        if (squadPlayerCount >= MAX_SQUAD_SIZE) {
            markUnsold(playerId, auctionId)
            throw InvalidAuctionStateException(
                "Squad '${squad.name}' is full ($MAX_SQUAD_SIZE players max) — player marked unsold"
            )
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

        // Store result for frontend polling
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
}