package com.example.ipl_backend.service

import com.example.ipl_backend.repository.PlayerRepository
import com.example.ipl_backend.repository.SquadRepository
import org.springframework.stereotype.Service
import java.util.UUID
import java.util.concurrent.*


@Service
class AuctionTimerService(
    private val hammerService: HammerService,
    private val squadRepository: SquadRepository,
    private val playerRepository: PlayerRepository,
    private val auctionEngineService: AuctionEngineService,
    private val liveAuctionService: LiveAuctionService
) {

    private val passedParticipants =
        ConcurrentHashMap<String, MutableSet<UUID>>()

    private val scheduler: ScheduledExecutorService =
        Executors.newScheduledThreadPool(4)

    private val activeTimers =
        ConcurrentHashMap<String, ScheduledFuture<*>>()

    private val AUCTION_TIMER_SECONDS = 10L

    fun startTimer(playerId: String, auctionId: String) {

        cancelTimer(playerId)

        val task = scheduler.schedule({

            try {
                hammerService.hammerPlayer(playerId, auctionId)
            } catch (ex: Exception) {
                println("⛔ Hammer failed: ${ex.message}")
            } finally {
                clearPasses(playerId)   // ✅ CRITICAL FIX
            }

        }, AUCTION_TIMER_SECONDS, TimeUnit.SECONDS)

        activeTimers[playerId] = task
    }

    fun resetTimer(playerId: String, auctionId: String) {
        startTimer(playerId, auctionId)
    }

    fun cancelTimer(playerId: String) {
        activeTimers[playerId]?.cancel(false)
        activeTimers.remove(playerId)
    }

    fun getPassSet(playerId: String): MutableSet<UUID> {
        return passedParticipants.computeIfAbsent(playerId) {
            ConcurrentHashMap.newKeySet()
        }
    }

    fun clearPasses(playerId: String) {
        passedParticipants.remove(playerId)
    }

    fun checkIfEveryonePassed(playerId: String, auctionId: String) {

        val totalParticipants =
            squadRepository.countParticipantsInAuction(auctionId)

        if (totalParticipants == 0L) return   // ✅ EDGE GUARD

        val passedCount =
            passedParticipants[playerId]?.size ?: 0

        if (passedCount >= totalParticipants) {

            println("⚠ Everyone passed → PLAYER UNSOLD")

            cancelTimer(playerId)

            playerRepository.markAsUnsold(playerId)
            auctionEngineService.loadNextPlayer(auctionId)

            liveAuctionService.broadcastMessage(playerId, "PLAYER_UNSOLD")

            clearPasses(playerId)
        }
    }
}