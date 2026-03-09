package com.example.ipl_backend.service

import com.example.ipl_backend.exception.AuctionNotFoundException
import com.example.ipl_backend.exception.InvalidAuctionStateException
import com.example.ipl_backend.model.Player
import com.example.ipl_backend.repository.AuctionPoolRepository
import com.example.ipl_backend.repository.AuctionRepository
import com.example.ipl_backend.repository.PlayerRepository
import org.springframework.stereotype.Service
import java.math.BigDecimal
import java.util.concurrent.ConcurrentHashMap

@Service
class AuctionEngineService(
    private val playerRepository: PlayerRepository,
    private val auctionRepository: AuctionRepository,
    private val auctionPoolRepository: AuctionPoolRepository,
    private val auctionTimerService: AuctionTimerService
) {

    private val currentPlayers = ConcurrentHashMap<String, Player>()
    private val biddingOpen    = ConcurrentHashMap<String, Boolean>()
    private val lastResults    = ConcurrentHashMap<String, LastResult>()
    private val poolExhausted  = ConcurrentHashMap<String, Boolean>()
    private val playerQueues   = ConcurrentHashMap<String, ArrayDeque<Player>>()

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
        // Uses markAsUnsoldIfNotAuctioned() which does SELECT FOR UPDATE + UPDATE
        // atomically in ONE transaction. Never nest transaction calls — doing
        // findById() + markAsUnsold() separately causes nested transactions in
        // Exposed which silently fail (inner tx does not commit).
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

        // Build queue lazily on first call if not yet initialized
        if (!playerQueues.containsKey(auctionId)) {
            initQueue(auctionId)
        }

        val queue = playerQueues[auctionId]!!

        // Skip any players already auctioned (handles server restarts gracefully)
        while (queue.isNotEmpty()) {
            val candidate = queue.first()
            val fresh = playerRepository.findById(candidate.id)
            if (fresh == null || fresh.isAuctioned) {
                queue.removeFirst()
                continue
            }
            break
        }

        if (queue.isEmpty()) {
            println("🏁 Queue exhausted — auction complete")
            poolExhausted[auctionId] = true
            currentPlayers.remove(auctionId)
            biddingOpen[auctionId] = false
            return
        }

        val nextPlayer = queue.removeFirst()
        poolExhausted[auctionId] = false
        currentPlayers[auctionId] = nextPlayer
        biddingOpen[auctionId]    = false

        println("🎯 Next player → ${nextPlayer.name} (${nextPlayer.specialism}, base=${nextPlayer.basePrice}) in auction=$auctionId")
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
        println("🔄 Engine state reset for auction=$auctionId")
    }
}