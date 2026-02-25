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
                clearPasses(playerId)
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

        if (totalParticipants == 0L) return

        val passedCount = passedParticipants[playerId]?.size ?: 0

        if (passedCount >= totalParticipants) {

            println("⚠ Everyone passed → cancelling timer and hammering immediately")

            // ✅ Cancel the scheduled 10s timer FIRST so it doesn't also
            //    fire hammerPlayer — then call hammer exactly once ourselves.
            //    Previously both paths called hammerPlayer independently
            //    causing the duplicate key crash on squad_players.
            cancelTimer(playerId)
            clearPasses(playerId)

            // Run hammer on a separate thread so we don't block the caller
            scheduler.submit {
                try {
                    hammerService.hammerPlayer(playerId, auctionId)
                } catch (ex: Exception) {
                    println("⛔ Everyone-passed hammer failed: ${ex.message}")
                }
            }
        }
    }
}