package com.example.ipl_backend.service

import org.springframework.context.annotation.Lazy
import org.springframework.stereotype.Service
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit

@Service
class AuctionTimerService(
    @Lazy private val auctionEngineService: AuctionEngineService
) {

    // playerId → running analysis timer future
    private val activeTimers = ConcurrentHashMap<String, ScheduledFuture<*>>()

    // playerId → timer state (for status queries via polling)
    private val timerState = ConcurrentHashMap<String, TimerState>()

    private val scheduler = Executors.newScheduledThreadPool(4)

    data class TimerState(
        val auctionId: String,
        val totalSecs: Int,
        @Volatile var secondsRemaining: Int
    )

    /**
     * Starts the analysis timer for a player.
     * When timer reaches 0 → sets biddingOpen=true in AuctionEngineService.
     * Frontend polls /engine/state to get secondsRemaining and biddingOpen.
     */
    fun startAnalysisTimer(playerId: String, auctionId: String, durationSecs: Int) {
        cancelTimer(playerId)

        val state = TimerState(auctionId, durationSecs, durationSecs)
        timerState[playerId] = state

        val tickTask = scheduler.scheduleAtFixedRate({
            val current = timerState[playerId] ?: return@scheduleAtFixedRate
            current.secondsRemaining -= 1

            if (current.secondsRemaining <= 0) {
                cancelTimer(playerId)
                auctionEngineService.onAnalysisTimerExpired(auctionId, playerId)
                println("⏰ Analysis timer expired → biddingOpen=true player=$playerId auction=$auctionId")
            }
        }, 1, 1, TimeUnit.SECONDS)

        activeTimers[playerId] = tickTask
        println("⏱ Analysis timer started: player=$playerId auction=$auctionId duration=${durationSecs}s")
    }

    fun cancelTimer(playerId: String) {
        activeTimers.remove(playerId)?.cancel(false)
        timerState.remove(playerId)
    }

    fun getSecondsRemaining(playerId: String): Int =
        timerState[playerId]?.secondsRemaining ?: 0

    fun getTotalSecs(playerId: String): Int =
        timerState[playerId]?.totalSecs ?: 0

    fun isTimerRunning(playerId: String): Boolean =
        activeTimers[playerId]?.isDone == false

    fun cancelAllForAuction(auctionId: String) {
        val toCancel = timerState.entries
            .filter { it.value.auctionId == auctionId }
            .map { it.key }
        toCancel.forEach { cancelTimer(it) }
        println("🛑 All timers cancelled for auction=$auctionId")
    }
}