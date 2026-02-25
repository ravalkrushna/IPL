package com.example.ipl_backend.service

import com.example.ipl_backend.repository.SquadRepository
import org.springframework.stereotype.Service
import java.util.UUID
import java.util.concurrent.*

@Service
class AuctionTimerService(
    private val hammerService: HammerService,
    private val squadRepository: SquadRepository,
    private val presenceService: ParticipantPresenceService,
) {

    private val passedParticipants  = ConcurrentHashMap<String, MutableSet<UUID>>()
    private val activeTimers        = ConcurrentHashMap<String, ScheduledFuture<*>>()
    // playerId → auctionId for every running timer (so we can find it by auction)
    private val activeTimerAuction  = ConcurrentHashMap<String, String>()
    // auctionId → playerId for players waiting on participants / paused
    private val pendingStart        = ConcurrentHashMap<String, String>()
    // sessionId → auctionId so disconnect events can look up the auction
    private val sessionAuction      = ConcurrentHashMap<String, String>()

    private val TIMER_SECONDS = 10L

    private val scheduler: ScheduledExecutorService =
        Executors.newScheduledThreadPool(4)

    /* ═══════════════════════════════════════════════
       PUBLIC API
    ═══════════════════════════════════════════════ */

    /**
     * Called by AuctionEngineService when a new player is ready.
     * If no participants are connected yet, parks the player and waits.
     */
    fun startTimer(playerId: String, auctionId: String) {
        cancelTimer(playerId)

        if (!presenceService.hasParticipants(auctionId)) {
            println("⏸ No participants in $auctionId — parking $playerId")
            pendingStart[auctionId] = playerId
            return
        }

        pendingStart.remove(auctionId)
        schedule(playerId, auctionId)
    }

    fun resetTimer(playerId: String, auctionId: String) = startTimer(playerId, auctionId)

    fun cancelTimer(playerId: String) {
        activeTimers.remove(playerId)?.cancel(false)
        activeTimerAuction.remove(playerId)
    }

    /** Admin pause — cancels the running timer, remembers the player for resume. */
    fun pauseTimer(auctionId: String) {
        val playerId = activeTimerAuction.entries
            .firstOrNull { it.value == auctionId }?.key
            ?: pendingStart[auctionId]  // already parked = already "paused"

        if (playerId != null) {
            println("⏸ Pausing auction $auctionId (player $playerId)")
            cancelTimer(playerId)
            pendingStart[auctionId] = playerId
        } else {
            println("⏸ pauseTimer: nothing active for auction $auctionId")
        }
    }

    /** Admin resume — restarts the timer for the last paused player. */
    fun resumeTimer(auctionId: String) {
        val playerId = pendingStart[auctionId]
        if (playerId == null) {
            println("▶️ resumeTimer: nothing pending for $auctionId")
            return
        }
        if (!presenceService.hasParticipants(auctionId)) {
            println("▶️ resumeTimer: no participants yet — staying parked")
            return
        }
        println("▶️ Resuming auction $auctionId (player $playerId)")
        pendingStart.remove(auctionId)
        schedule(playerId, auctionId)
    }

    /**
     * Called by WebSocketPresenceListener when the FIRST participant subscribes.
     * Kicks off a parked timer automatically (auto-resume on first join).
     */
    fun onParticipantsAvailable(auctionId: String) {
        val playerId = pendingStart[auctionId] ?: return
        println("▶️ First participant in $auctionId — auto-starting timer for $playerId")
        pendingStart.remove(auctionId)
        schedule(playerId, auctionId)
    }

    /** Register sessionId → auctionId mapping on subscribe. */
    fun registerSession(sessionId: String, auctionId: String) {
        sessionAuction[sessionId] = auctionId
    }

    /**
     * Called by WebSocketPresenceListener on disconnect.
     * Pauses the timer if the auction now has zero participants.
     */
    fun onSessionDisconnected(sessionId: String) {
        val auctionId = sessionAuction.remove(sessionId) ?: return
        presenceService.onDisconnect(auctionId, sessionId)

        if (!presenceService.hasParticipants(auctionId)) {
            println("⏸ Last participant left $auctionId — auto-pausing timer")
            pauseTimer(auctionId)
        }
    }

    fun getPassSet(playerId: String): MutableSet<UUID> =
        passedParticipants.computeIfAbsent(playerId) { ConcurrentHashMap.newKeySet() }

    fun clearPasses(playerId: String) {
        passedParticipants.remove(playerId)
    }

    fun checkIfEveryonePassed(playerId: String, auctionId: String) {
        val total = squadRepository.countParticipantsInAuction(auctionId)
        if (total == 0L) return

        val passed = passedParticipants[playerId]?.size ?: 0
        if (passed >= total) {
            println("⚠ Everyone passed → hammering immediately")
            cancelTimer(playerId)
            clearPasses(playerId)
            scheduler.submit {
                try   { hammerService.hammerPlayer(playerId, auctionId) }
                catch (ex: Exception) { println("⛔ Everyone-passed hammer failed: ${ex.message}") }
            }
        }
    }

    /* ═══════════════════════════════════════════════
       PRIVATE
    ═══════════════════════════════════════════════ */

    private fun schedule(playerId: String, auctionId: String) {
        activeTimerAuction[playerId] = auctionId
        val task = scheduler.schedule({
            try   { hammerService.hammerPlayer(playerId, auctionId) }
            catch (ex: Exception) { println("⛔ Hammer failed: ${ex.message}") }
            finally {
                clearPasses(playerId)
                activeTimerAuction.remove(playerId)
            }
        }, TIMER_SECONDS, TimeUnit.SECONDS)
        activeTimers[playerId] = task
    }
}