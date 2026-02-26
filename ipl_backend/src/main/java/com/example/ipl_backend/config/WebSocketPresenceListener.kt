package com.example.ipl_backend.config

import com.example.ipl_backend.service.AuctionTimerService
import com.example.ipl_backend.service.ParticipantPresenceService
import org.springframework.context.event.EventListener
import org.springframework.messaging.simp.stomp.StompHeaderAccessor
import org.springframework.stereotype.Component
import org.springframework.web.socket.messaging.SessionDisconnectEvent
import org.springframework.web.socket.messaging.SessionSubscribeEvent

/**
 * Listens for WebSocket SUBSCRIBE / DISCONNECT events.
 *
 * The frontend subscribes to /topic/auction/{playerId} — so the ID
 * extracted from the destination is a PLAYER ID, not an auction ID.
 * All presence and timer calls use playerId accordingly.
 */
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

        // Only care about /topic/auction/{playerId}
        val playerId = extractPlayerId(destination) ?: return

        val wasEmpty = !presenceService.hasParticipants(playerId)
        presenceService.onConnect(playerId, sessionId)

        // Register so disconnect can find the playerId for this session
        auctionTimerService.registerSession(sessionId, playerId)

        if (wasEmpty) {
            println("▶️ First participant subscribed to player topic $playerId — unparking timer")
            auctionTimerService.onParticipantsAvailable(playerId)
        }
    }

    @EventListener
    fun onDisconnect(event: SessionDisconnectEvent) {
        val accessor  = StompHeaderAccessor.wrap(event.message)
        val sessionId = accessor.sessionId ?: return
        auctionTimerService.onSessionDisconnected(sessionId)
    }

    /** Extracts the playerId from /topic/auction/{playerId}. Returns null for other topics. */
    private fun extractPlayerId(destination: String): String? {
        val prefix = "/topic/auction/"
        if (!destination.startsWith(prefix)) return null
        val id = destination.removePrefix(prefix).trim()
        return id.ifBlank { null }
    }
}