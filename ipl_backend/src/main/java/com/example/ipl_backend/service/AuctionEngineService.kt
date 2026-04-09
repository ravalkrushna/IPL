package com.example.ipl_backend.service

import com.example.ipl_backend.exception.AuctionNotFoundException
import com.example.ipl_backend.exception.InvalidAuctionStateException
import com.example.ipl_backend.model.AuctionStatus
import com.example.ipl_backend.model.BidType
import com.example.ipl_backend.model.Player
import com.example.ipl_backend.model.PoolStatus
import com.example.ipl_backend.model.PoolType
import com.example.ipl_backend.repository.AuctionPoolRepository
import com.example.ipl_backend.repository.AuctionRepository
import com.example.ipl_backend.repository.BidRepository
import com.example.ipl_backend.repository.PlayerRepository
import com.example.ipl_backend.repository.SquadRepository
import com.example.ipl_backend.repository.WalletRepository
import org.springframework.stereotype.Service
import java.math.BigDecimal
import java.util.concurrent.ConcurrentHashMap

@Service
class AuctionEngineService(
    private val playerRepository: PlayerRepository,
    private val auctionRepository: AuctionRepository,
    private val auctionPoolRepository: AuctionPoolRepository,
    private val auctionTimerService: AuctionTimerService,
    private val auctionPoolService: AuctionPoolService,
    private val bidRepository: BidRepository,
    private val bidLogService: BidLogService,
    private val squadRepository: SquadRepository,
    private val walletRepository: WalletRepository
) {

    private val currentPlayers       = ConcurrentHashMap<String, Player>()
    private val biddingOpen          = ConcurrentHashMap<String, Boolean>()
    private val lastResults          = ConcurrentHashMap<String, LastResult>()
    private val poolExhausted        = ConcurrentHashMap<String, Boolean>()
    private val playerQueues         = ConcurrentHashMap<String, ArrayDeque<Player>>()
    /** 1 = main round; each unsold-only round increments (2, 3, …). */
    private val auctionRound         = ConcurrentHashMap<String, Int>()
    private val reauctionMode        = ConcurrentHashMap<String, Boolean>()
    private val reauctionPhase1Ids   = ConcurrentHashMap<String, Set<String>>()
    private val phase1Exhausted      = ConcurrentHashMap<String, Boolean>()

    data class LastResult(
        val playerName: String,
        val squadName: String?,
        val amount: BigDecimal?,
        val unsold: Boolean,
        val timestamp: Long = System.currentTimeMillis()
    )

    fun getCurrentPlayer(auctionId: String): Player? = currentPlayers[auctionId]
    fun isBiddingOpen(auctionId: String): Boolean    = biddingOpen[auctionId] == true
    fun getLastResult(auctionId: String): LastResult? = lastResults[auctionId]
    fun isPoolExhausted(auctionId: String): Boolean  = poolExhausted[auctionId] == true

    fun getAuctionRound(auctionId: String): Int = auctionRound[auctionId] ?: 1
    fun isReauctionMode(auctionId: String): Boolean = reauctionMode[auctionId] == true
    fun isPhase1Exhausted(auctionId: String): Boolean = phase1Exhausted[auctionId] == true

    /** Unsold players eligible for the next unsold-only round (same rows the next round will queue). */
    fun getUnsoldCandidatesForAuction(auctionId: String): List<Player> {
        auctionRepository.findById(auctionId) ?: throw AuctionNotFoundException("Auction not found")
        return playerRepository.findAuctionedButUnsoldPlayers()
    }

    // ─── QUEUE ───────────────────────────────────────────────────────────────

    fun initQueue(auctionId: String) {
        val allPlayers: List<Player> = playerRepository.findAll()
            .filter { !it.isAuctioned }

        val grouped: Map<BigDecimal, List<Player>> = allPlayers
            .groupBy { player -> player.basePrice }

        val sorted: List<Map.Entry<BigDecimal, List<Player>>> = grouped.entries
            .sortedByDescending { entry -> entry.key }

        val queue: List<Player> = sorted
            .flatMap { entry -> entry.value.shuffled() }

        playerQueues[auctionId] = ArrayDeque(queue)
        println("📋 Queue built for auction=$auctionId — ${playerQueues[auctionId]?.size} players")
    }

    // ─── NEXT PLAYER ─────────────────────────────────────────────────────────

    fun loadNextPlayer(auctionId: String) {
        auctionRepository.findById(auctionId)
            ?: throw AuctionNotFoundException("Auction not found")

        auctionPoolRepository.findActivePool(auctionId)
            ?: throw InvalidAuctionStateException("No active pool — admin must activate the auction first")

        // ── Mark previous player as unsold if skipped ──────────────────────
        val existingPlayer = currentPlayers[auctionId]
        if (existingPlayer != null) {
            val wasMarked = playerRepository.markAsUnsoldIfNotAuctioned(existingPlayer.id)
            if (wasMarked) {
                auctionTimerService.cancelTimer(existingPlayer.id)
                setLastResult(auctionId, LastResult(
                    playerName = existingPlayer.name,
                    squadName  = null,
                    amount     = null,
                    unsold     = true
                ))
                println("⚠️ Player ${existingPlayer.name} auto-marked UNSOLD (skipped via Next Player)")
            }
        }

        // Build queue lazily on first call if not yet initialized (main round only)
        if (!playerQueues.containsKey(auctionId)) {
            if (getAuctionRound(auctionId) <= 1) {
                initQueue(auctionId)
            } else {
                throw InvalidAuctionStateException(
                    "No queue for this unsold round — call POST .../start-unsold-round first"
                )
            }
        }

        val queue = playerQueues[auctionId]!!

        // Always fetch fresh from DB so all fields (battingStyle, bowlingStyle,
        // testCaps, odiCaps, t20Caps, basePrice etc.) are up to date
        while (queue.isNotEmpty()) {
            val candidate = queue.removeFirst()
            val fresh = playerRepository.findById(candidate.id)

            // Skip if deleted or already auctioned
            if (fresh == null || fresh.isAuctioned) {
                continue
            }

            // Valid player found — use fresh DB copy, not stale queue entry
            poolExhausted[auctionId] = false
            currentPlayers[auctionId] = fresh
            biddingOpen[auctionId] = false
            println("🎯 Next player → ${fresh.name} (${fresh.specialism}, base=${fresh.basePrice}) in auction=$auctionId")
            return
        }

        // Queue exhausted
        if (reauctionMode[auctionId] == true && phase1Exhausted[auctionId] != true) {
            println("🏁 Re-auction Phase 1 exhausted — all previously sold players auctioned")
            phase1Exhausted[auctionId] = true
        } else {
            println("🏁 Queue exhausted — auction complete")
        }
        poolExhausted[auctionId] = true
        currentPlayers.remove(auctionId)
        biddingOpen[auctionId] = false
    }

    // ─── UPCOMING PLAYERS ────────────────────────────────────────────────────

    fun getUpcomingPlayers(auctionId: String): List<Player> {
        val queue = playerQueues[auctionId] ?: return emptyList()
        return queue.take(5)
    }

    // ─── TIMER ───────────────────────────────────────────────────────────────

    fun onAnalysisTimerExpired(auctionId: String, playerId: String) {
        biddingOpen[auctionId] = true
        println("✅ Bidding OPEN for player=$playerId auction=$auctionId")
    }

    fun startAnalysisTimer(auctionId: String) {
        val auction = auctionRepository.findById(auctionId)
            ?: throw AuctionNotFoundException("Auction not found")
        val player = currentPlayers[auctionId]
            ?: throw InvalidAuctionStateException("No current player — press Next Player first")

        biddingOpen[auctionId] = false
        auctionTimerService.startAnalysisTimer(
            playerId     = player.id,
            auctionId    = auctionId,
            durationSecs = auction.analysisTimerSecs
        )
    }

    // ─── MISC ────────────────────────────────────────────────────────────────

    fun clearCurrentPlayer(auctionId: String) {
        currentPlayers.remove(auctionId)
        biddingOpen[auctionId] = false
    }

    fun setLastResult(auctionId: String, result: LastResult) {
        lastResults[auctionId] = result
    }

    fun setBiddingClosed(auctionId: String) {
        biddingOpen[auctionId] = false
    }

    fun resetForNewAuction(auctionId: String) {
        currentPlayers.remove(auctionId)
        biddingOpen.remove(auctionId)
        lastResults.remove(auctionId)
        poolExhausted.remove(auctionId)
        playerQueues.remove(auctionId)
        auctionRound.remove(auctionId)
        reauctionMode.remove(auctionId)
        reauctionPhase1Ids.remove(auctionId)
        phase1Exhausted.remove(auctionId)
        println("🔄 Engine state reset for auction=$auctionId")
    }

    /**
     * After the current round’s queue is exhausted, starts the next round with only
     * auctioned-but-unsold players (clears their bids for this auction and resets [Players.isAuctioned]
     * so bidding works again). May be invoked repeatedly for round 3, 4, … until no unsold remain.
     */
    fun startUnsoldRound(auctionId: String): StartUnsoldRoundResult {
        val auction = auctionRepository.findById(auctionId)
            ?: throw AuctionNotFoundException("Auction not found")
        if (auction.status != AuctionStatus.LIVE) {
            throw InvalidAuctionStateException("Auction must be LIVE to start an unsold round")
        }
        if (poolExhausted[auctionId] != true) {
            throw InvalidAuctionStateException(
                "Finish the current round first — the player queue must be exhausted before the next unsold round"
            )
        }

        val unsold = playerRepository.findAuctionedButUnsoldPlayers()
        if (unsold.isEmpty()) {
            throw InvalidAuctionStateException("No unsold players — everyone sold or no one was auctioned yet")
        }

        val ids = unsold.map { it.id }
        bidRepository.deleteForPlayersInAuction(ids, auctionId)
        playerRepository.clearAuctionedFlagForPlayerIds(ids)

        val grouped = unsold.groupBy { it.basePrice }
        val queue: List<Player> = grouped.entries
            .sortedByDescending { it.key }
            .flatMap { (_, players) -> players.shuffled() }
        playerQueues[auctionId] = ArrayDeque(queue)

        val nextRound = getAuctionRound(auctionId) + 1
        auctionRound[auctionId] = nextRound

        poolExhausted[auctionId] = false
        currentPlayers.remove(auctionId)
        biddingOpen[auctionId] = false
        auctionTimerService.cancelAllForAuction(auctionId)

        ensurePoolActiveForUnsoldRound(auctionId)

        bidLogService.logBid(
            auctionId = auctionId,
            playerId  = null,
            bidType   = BidType.UNSOLD_ROUND_STARTED
        )
        println("🔁 Unsold round started for auction=$auctionId → round=$nextRound, ${queue.size} players")

        return StartUnsoldRoundResult(
            auctionRound   = nextRound,
            queuedPlayers  = queue.size,
            playerPreviews = queue.take(20)
        )
    }

    fun activatePoolForReauction(auctionId: String) = ensurePoolActiveForUnsoldRound(auctionId)

    private fun ensurePoolActiveForUnsoldRound(auctionId: String) {
        val allPool = auctionPoolRepository.findByAuctionAndType(auctionId, PoolType.ALL)
            ?: throw InvalidAuctionStateException("No ALL pool for auction $auctionId")

        when (allPool.status) {
            PoolStatus.COMPLETED -> {
                auctionPoolRepository.updateStatus(allPool.id, PoolStatus.PENDING)
                auctionPoolService.activatePool(auctionId, PoolType.ALL)
            }
            PoolStatus.PENDING, PoolStatus.PAUSED ->
                auctionPoolService.activatePool(auctionId, PoolType.ALL)
            PoolStatus.ACTIVE -> { /* already running */ }
        }
    }

    data class StartUnsoldRoundResult(
        val auctionRound: Int,
        val queuedPlayers: Int,
        val playerPreviews: List<Player>
    )

    // ─── RE-AUCTION ──────────────────────────────────────────────────────────

    fun initReauctionMode(auctionId: String, phase1PlayerIds: List<String>) {
        reauctionMode[auctionId] = true
        reauctionPhase1Ids[auctionId] = phase1PlayerIds.toSet()
        phase1Exhausted[auctionId] = false

        val players = playerRepository.findByIds(phase1PlayerIds)
        val queue: List<Player> = players
            .groupBy { it.basePrice }
            .entries
            .sortedByDescending { it.key }
            .flatMap { (_, ps) -> ps.shuffled() }
        playerQueues[auctionId] = ArrayDeque(queue)
        println("🔁 Re-auction mode initialized for auction=$auctionId — Phase 1: ${queue.size} previously sold players")
    }

    fun startRemainingPoolPhase(auctionId: String) {
        if (reauctionMode[auctionId] != true) {
            throw InvalidAuctionStateException("Not in re-auction mode")
        }
        if (phase1Exhausted[auctionId] != true) {
            throw InvalidAuctionStateException("Phase 1 is not yet exhausted — finish auctioning all previously sold players first")
        }

        val excludedIds = reauctionPhase1Ids[auctionId] ?: emptySet()
        val remainingPlayers = playerRepository.findAll()
            .filter { !it.isAuctioned && it.id !in excludedIds }

        if (remainingPlayers.isEmpty()) {
            throw InvalidAuctionStateException("No remaining pool players to auction")
        }

        val queue: List<Player> = remainingPlayers
            .groupBy { it.basePrice }
            .entries
            .sortedByDescending { it.key }
            .flatMap { (_, ps) -> ps.shuffled() }
        playerQueues[auctionId] = ArrayDeque(queue)

        phase1Exhausted[auctionId] = false
        poolExhausted[auctionId] = false
        currentPlayers.remove(auctionId)
        biddingOpen[auctionId] = false
        auctionTimerService.cancelAllForAuction(auctionId)

        ensurePoolActiveForUnsoldRound(auctionId)
        println("🔁 Re-auction Phase 2 started for auction=$auctionId — ${queue.size} pool players queued")
    }

    data class ReauctionPhaseStatus(
        val isReauctionMode: Boolean,
        val phase1Exhausted: Boolean,
        val squadsNeedingPlayers: Int,
        val squadsWithBudget: Int,
        val hasRemainingPoolPlayers: Boolean
    )

    fun getReauctionPhaseStatus(auctionId: String): ReauctionPhaseStatus {
        val squads = squadRepository.findByAuction(auctionId)
        val wallets = walletRepository.findAllByAuction(auctionId)
        val walletByParticipant = wallets.associateBy { it.participantId }

        val squadsNeedingPlayers = squads.count { squad ->
            squadRepository.countPlayers(squad.id) < 20
        }
        val squadsWithBudget = squads.count { squad ->
            val wallet = walletByParticipant[squad.participantId]
            wallet != null && wallet.balance > BigDecimal.ZERO
        }

        val excludedIds = reauctionPhase1Ids[auctionId] ?: emptySet()
        val hasRemainingPoolPlayers = playerRepository.findAll()
            .any { !it.isAuctioned && it.id !in excludedIds }

        return ReauctionPhaseStatus(
            isReauctionMode         = reauctionMode[auctionId] == true,
            phase1Exhausted         = phase1Exhausted[auctionId] == true,
            squadsNeedingPlayers    = squadsNeedingPlayers,
            squadsWithBudget        = squadsWithBudget,
            hasRemainingPoolPlayers = hasRemainingPoolPlayers
        )
    }
}