package com.example.ipl_backend.service

import com.example.ipl_backend.dto.AuctionEvent
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.stereotype.Service
import java.math.BigDecimal
import java.util.UUID

@Service
class LiveAuctionService(
    private val messagingTemplate: SimpMessagingTemplate
) {

    private fun topic(playerId: String) = "/topic/auction/$playerId"

    fun broadcastNewBid(
        playerId: String,
        participantId: UUID,
        amount: BigDecimal,
        squadName: String
    ) {
        val payload = AuctionEvent(
            type = "NEW_BID",
            playerId = playerId,
            participantId = participantId.toString(),
            amount = amount,
            squadName = squadName
        )
        messagingTemplate.convertAndSend(topic(playerId), payload)
    }

    fun broadcastPlayerSold(
        playerId: String,
        participantId: UUID,
        amount: BigDecimal,
        squadName: String
    ) {
        val payload = AuctionEvent(
            type = "PLAYER_SOLD",
            playerId = playerId,
            participantId = participantId.toString(),
            amount = amount,
            squadName = squadName
        )
        messagingTemplate.convertAndSend(topic(playerId), payload)
    }

    // ✅ FIXED: send wallet update ONLY to the specific participant
    //    using convertAndSendToUser → /user/{participantId}/queue/wallet
    //    This prevents overwriting every other user's wallet display
    fun broadcastWalletUpdate(
        participantId: UUID,
        walletBalance: BigDecimal
    ) {
        val payload = AuctionEvent(
            type = "WALLET_UPDATE",
            walletBalance = walletBalance
        )
        messagingTemplate.convertAndSendToUser(
            participantId.toString(),   // STOMP "user" — must match the Principal name
            "/queue/wallet",            // destination — becomes /user/{participantId}/queue/wallet
            payload
        )
    }

    fun broadcastTimerTick(playerId: String, secondsRemaining: Int) {
        val payload = AuctionEvent(
            type = "TIMER_TICK",
            playerId = playerId,
            message = secondsRemaining.toString()
        )
        messagingTemplate.convertAndSend(topic(playerId), payload)
    }

    fun broadcastTimerExpired(playerId: String) {
        val payload = AuctionEvent(
            type = "TIMER_EXPIRED",
            playerId = playerId
        )
        messagingTemplate.convertAndSend(topic(playerId), payload)
    }

    fun broadcastMessage(playerId: String, message: String) {
        val payload = AuctionEvent(
            type = "SYSTEM_MESSAGE",
            playerId = playerId,
            message = message
        )
        messagingTemplate.convertAndSend(topic(playerId), payload)
    }
}