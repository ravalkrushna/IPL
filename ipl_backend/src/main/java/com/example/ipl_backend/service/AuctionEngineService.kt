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

    // auctionId → current player being auctioned
    private val currentPlayers = ConcurrentHashMap<String, Player>()

    // auctionId → whether bidding is currently open
    private val biddingOpen = ConcurrentHashMap<String, Boolean>()

    // auctionId → last hammer result (for polling)
    private val lastResults = ConcurrentHashMap<String, LastResult>()

    // auctionId → pool exhausted flag
    private val poolExhausted = ConcurrentHashMap<String, Boolean>()

    data class LastResult(
        val playerName: String,
        val squadName: String?,
        val amount: BigDecimal?,
        val unsold: Boolean,
        val timestamp: Long = System.currentTimeMillis()
    )

    fun getCurrentPlayer(auctionId: String): Player? =
        currentPlayers[auctionId]

    fun isBiddingOpen(auctionId: String): Boolean =
        biddingOpen[auctionId] == true

    fun getLastResult(auctionId: String): LastResult? =
        lastResults[auctionId]

    fun isPoolExhausted(auctionId: String): Boolean =
        poolExhausted[auctionId] == true

    /**
     * Admin explicitly calls this to move to the next player in the active pool.
     */
    fun loadNextPlayer(auctionId: String) {
        val auction = auctionRepository.findById(auctionId)
            ?: throw AuctionNotFoundException("Auction not found")

        val activePool = auctionPoolRepository.findActivePool(auctionId)
            ?: throw InvalidAuctionStateException("No active pool — admin must activate a pool first")

        // If there's a current player who was never hammered, mark them as unsold
        // so they don't appear again in the queue
        val existingPlayer = currentPlayers[auctionId]
        if (existingPlayer != null) {
            val playerState = playerRepository.findById(existingPlayer.id)
            if (playerState != null && !playerState.isAuctioned) {
                playerRepository.markAsUnsold(existingPlayer.id)
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

        val nextPlayer = playerRepository.findNextAvailablePlayerInPool(
            auctionId  = auctionId,
            specialism = activePool.poolType.name
        )

        if (nextPlayer == null) {
            println("🏁 Pool ${activePool.poolType} exhausted — no more players")
            poolExhausted[auctionId] = true
            currentPlayers.remove(auctionId)
            biddingOpen[auctionId] = false
            return
        }

        poolExhausted[auctionId] = false
        currentPlayers[auctionId] = nextPlayer
        biddingOpen[auctionId] = false

        println("🎯 Next player → ${nextPlayer.name} (${nextPlayer.specialism}) in auction=$auctionId")
        // Timer is NOT auto-started — admin must click "Start Analysis Timer" explicitly
    }

    /** Called by AuctionTimerService when analysis timer expires */
    fun onAnalysisTimerExpired(auctionId: String, playerId: String) {
        biddingOpen[auctionId] = true
        println("✅ Bidding OPEN for player=$playerId auction=$auctionId")
    }

    /** Admin restarts analysis timer manually */
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

    /** Called after hammer — clears current player state and stores result for polling */
    fun clearCurrentPlayer(auctionId: String) {
        currentPlayers.remove(auctionId)
        biddingOpen[auctionId] = false
    }

    /** Store hammer result so frontend can poll it */
    fun setLastResult(auctionId: String, result: LastResult) {
        lastResults[auctionId] = result
    }

    /** Called when pool is paused — closes bidding without clearing the current player */
    fun setBiddingClosed(auctionId: String) {
        biddingOpen[auctionId] = false
    }

    /** Called when a new auction goes LIVE — wipes all in-memory state for that auctionId */
    fun resetForNewAuction(auctionId: String) {
        currentPlayers.remove(auctionId)
        biddingOpen.remove(auctionId)
        lastResults.remove(auctionId)
        poolExhausted.remove(auctionId)
        println("🔄 Engine state reset for auction=$auctionId")
    }
}