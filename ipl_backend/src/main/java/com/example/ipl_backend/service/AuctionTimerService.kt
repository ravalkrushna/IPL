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

    private val passedParticipants   = ConcurrentHashMap<String, MutableSet<UUID>>()
    private val activeTimers         = ConcurrentHashMap<String, ScheduledFuture<*>>()
    private val timerAuction         = ConcurrentHashMap<String, String>() // playerId → auctionId (running)
    private val pendingStart         = ConcurrentHashMap<String, String>() // playerId → auctionId (parked)
    private val sessionPlayer        = ConcurrentHashMap<String, String>() // sessionId → playerId
    private val auctionCurrentPlayer = ConcurrentHashMap<String, String>() // auctionId → playerId

    private val TIMER_SECONDS = 10L
    private val scheduler: ScheduledExecutorService = Executors.newScheduledThreadPool(4)

    /* ═══════════════════ PUBLIC API ═══════════════════ */

    fun startTimer(playerId: String, auctionId: String) {
        cancelTimer(playerId)
        auctionCurrentPlayer[auctionId] = playerId

        if (!presenceService.hasParticipants(playerId)) {
            println("⏸ No participants on player topic $playerId — parking")
            pendingStart[playerId] = auctionId
            return
        }

        schedule(playerId, auctionId)
    }

    fun resetTimer(playerId: String, auctionId: String) = startTimer(playerId, auctionId)

    fun cancelTimer(playerId: String) {
        activeTimers.remove(playerId)?.cancel(false)
        timerAuction.remove(playerId)
    }

    fun onParticipantsAvailable(playerId: String) {
        val auctionId = pendingStart.remove(playerId) ?: return
        println("▶️ onParticipantsAvailable: starting parked timer for player=$playerId auction=$auctionId")
        schedule(playerId, auctionId)
    }

    fun onSessionDisconnected(sessionId: String) {
        val playerId = sessionPlayer.remove(sessionId) ?: return
        presenceService.onDisconnect(playerId, sessionId)

        if (!presenceService.hasParticipants(playerId)) {
            val auctionId = timerAuction[playerId] ?: pendingStart[playerId]
            if (auctionId != null) {
                println("⏸ Last participant left player topic $playerId — pausing timer")
                cancelTimer(playerId)
                pendingStart[playerId] = auctionId
            }
        }
    }

    fun registerSession(sessionId: String, playerId: String) {
        sessionPlayer[sessionId] = playerId
    }

    fun pauseTimer(auctionId: String) {
        val playerId = auctionCurrentPlayer[auctionId] ?: run {
            println("⏸ pauseTimer: no current player for auction $auctionId")
            return
        }
        println("⏸ Admin pause: auction=$auctionId player=$playerId")
        cancelTimer(playerId)
        pendingStart[playerId] = auctionId
    }

    fun resumeTimer(auctionId: String) {
        val playerId = auctionCurrentPlayer[auctionId] ?: run {
            println("▶️ resumeTimer: no current player for auction $auctionId")
            return
        }
        val auctionIdFromPending = pendingStart.remove(playerId) ?: run {
            println("▶️ resumeTimer: player $playerId not in pendingStart")
            return
        }
        if (!presenceService.hasParticipants(playerId)) {
            println("▶️ resumeTimer: no participants yet — re-parking $playerId")
            pendingStart[playerId] = auctionIdFromPending
            return
        }
        println("▶️ Admin resume: auction=$auctionId player=$playerId")
        schedule(playerId, auctionIdFromPending)
    }

    fun getPassSet(playerId: String): MutableSet<UUID> =
        passedParticipants.computeIfAbsent(playerId) { ConcurrentHashMap.newKeySet() }

    fun clearPasses(playerId: String) = passedParticipants.remove(playerId)

    fun checkIfEveryonePassed(playerId: String, auctionId: String) {
        val total  = squadRepository.countParticipantsInAuction(auctionId)
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

    /* ═══════════════════ PRIVATE ═══════════════════ */

    private fun schedule(playerId: String, auctionId: String) {
        timerAuction[playerId] = auctionId
        val task = scheduler.schedule({
            try   { hammerService.hammerPlayer(playerId, auctionId) }
            catch (ex: Exception) { println("⛔ Hammer failed: ${ex.message}") }
            finally {
                clearPasses(playerId)
                timerAuction.remove(playerId)
                presenceService.clearPlayer(playerId)
            }
        }, TIMER_SECONDS, TimeUnit.SECONDS)
        activeTimers[playerId] = task
        println("⏱ Timer scheduled: player=$playerId auction=$auctionId")
    }
}