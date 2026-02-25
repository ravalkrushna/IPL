package com.example.ipl_backend.service

import com.example.ipl_backend.model.Player
import com.example.ipl_backend.repository.PlayerRepository
import org.springframework.context.annotation.Lazy
import org.springframework.stereotype.Service

@Service
class AuctionEngineService(
    private val playerRepository: PlayerRepository,
    @Lazy private val auctionTimerService: AuctionTimerService  // ✅ @Lazy breaks circular dependency
) {

    @Volatile
    private var currentPlayer: Player? = null

    fun getCurrentPlayer(auctionId: String): Player? {

        if (currentPlayer == null) {
            println("♻️ Engine recovery → loading player")
            loadNextPlayer(auctionId)
        }

        return currentPlayer
    }

    fun loadNextPlayer(auctionId: String) {

        val nextPlayer = playerRepository.findNextAvailablePlayer(auctionId)

        if (nextPlayer == null) {
            println("🏁 Auction finished")
            currentPlayer = null
            return
        }

        println("🎯 Next Player → ${nextPlayer.name}")

        currentPlayer = nextPlayer

        // ✅ ADDED: start the countdown for the new player
        auctionTimerService.startTimer(nextPlayer.id, auctionId)
    }
}