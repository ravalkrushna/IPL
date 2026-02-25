package com.example.ipl_backend.config

import org.springframework.http.server.ServerHttpRequest
import org.springframework.web.socket.WebSocketHandler
import org.springframework.web.socket.server.support.DefaultHandshakeHandler
import java.security.Principal

/**
 * Sets the STOMP "user" Principal to the participantId passed as a query param.
 *
 * Frontend must connect like:
 *   new SockJS("http://localhost:8080/ws?participantId=<UUID>")
 *
 * This allows convertAndSendToUser(participantId, ...) to route wallet
 * updates only to the correct participant.
 */
class ParticipantHandshakeHandler : DefaultHandshakeHandler() {

    override fun determineUser(
        request: ServerHttpRequest,
        wsHandler: WebSocketHandler,
        attributes: MutableMap<String, Any>
    ): Principal? {
        val participantId = request.uri.query
            ?.split("&")
            ?.firstOrNull { it.startsWith("participantId=") }
            ?.removePrefix("participantId=")

        return if (!participantId.isNullOrBlank()) {
            Principal { participantId }
        } else {
            super.determineUser(request, wsHandler, attributes)
        }
    }
}