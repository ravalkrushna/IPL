package com.example.ipl_backend.service

import com.example.ipl_backend.dto.AuctionEvent
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.stereotype.Service

@Service
class AuctionEventService(
    private val messagingTemplate: SimpMessagingTemplate
) {

    fun broadcast(event: AuctionEvent) {
        messagingTemplate.convertAndSend(
            "/topic/auction",
            event
        )
    }
}