package com.example.ipl_backend.config

import com.example.ipl_backend.service.AuctionTimerService
import com.example.ipl_backend.service.ParticipantPresenceService
import org.springframework.context.event.EventListener
import org.springframework.messaging.simp.stomp.StompHeaderAccessor
import org.springframework.stereotype.Component
import org.springframework.web.socket.messaging.SessionSubscribeEvent
import org.springframework.web.socket.messaging.SessionDisconnectEvent

@Component
class WebSocketPresenceListener(
    private val presenceService: ParticipantPresenceService,
    private val auctionTimerService: AuctionTimerService,
) {

    @EventListener
    fun onSubscribe(event: SessionSubscribeEvent) {
        val accessor    = StompHeaderAccessor.wrap(event.message)
        val destination = accessor.destination ?: return
        val sessionId   = accessor.sessionId   ?: return

        val auctionId = extractAuctionId(destination) ?: return

        auctionTimerService.registerSession(sessionId, auctionId)

        val wasEmpty = !presenceService.hasParticipants(auctionId)
        presenceService.onConnect(auctionId, sessionId)

        if (wasEmpty) {
            println("▶️ First participant subscribed to auction $auctionId")
            auctionTimerService.onParticipantsAvailable(auctionId)
        }
    }

    @EventListener
    fun onDisconnect(event: SessionDisconnectEvent) {
        val accessor  = StompHeaderAccessor.wrap(event.message)
        val sessionId = accessor.sessionId ?: return
        auctionTimerService.onSessionDisconnected(sessionId)
    }

    private fun extractAuctionId(destination: String): String? {
        val prefix = "/topic/auction/"
        if (!destination.startsWith(prefix)) return null
        val rest = destination.removePrefix(prefix).trim()
        return rest.ifBlank { null }
    }
}