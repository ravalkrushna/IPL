package com.example.ipl_backend.config

import org.springframework.context.annotation.Configuration
import org.springframework.messaging.simp.config.MessageBrokerRegistry
import org.springframework.web.socket.config.annotation.*

@Configuration
@EnableWebSocketMessageBroker
class WebSocketConfig : WebSocketMessageBrokerConfigurer {

    override fun registerStompEndpoints(registry: StompEndpointRegistry) {
        registry.addEndpoint("/ws")
            .setHandshakeHandler(ParticipantHandshakeHandler()) // ✅ ADDED
            .setAllowedOriginPatterns("*")
            .withSockJS()
    }

    override fun configureMessageBroker(registry: MessageBrokerRegistry) {
        registry.enableSimpleBroker("/topic", "/queue") // ✅ /queue needed for private wallet messages
        registry.setApplicationDestinationPrefixes("/app")
        registry.setUserDestinationPrefix("/user")      // ✅ routes /user/{participantId}/queue/wallet
    }
}