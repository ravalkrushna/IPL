package com.example.ipl_backend.service

import org.springframework.stereotype.Service
import java.util.concurrent.ConcurrentHashMap

/**
 * Tracks how many participant WebSocket sessions are currently connected
 * to each auction topic. The timer will not start (or will pause) when
 * the connected count for an auction drops to zero.
 */
@Service
class ParticipantPresenceService {

    // auctionId → set of sessionIds currently subscribed
    private val sessions = ConcurrentHashMap<String, MutableSet<String>>()

    fun onConnect(auctionId: String, sessionId: String) {
        sessions.computeIfAbsent(auctionId) { ConcurrentHashMap.newKeySet() }
            .add(sessionId)
        println("👤 Participant connected to auction $auctionId — total: ${count(auctionId)}")
    }

    fun onDisconnect(auctionId: String, sessionId: String) {
        sessions[auctionId]?.remove(sessionId)
        println("👤 Participant disconnected from auction $auctionId — total: ${count(auctionId)}")
    }

    fun count(auctionId: String): Int = sessions[auctionId]?.size ?: 0

    fun hasParticipants(auctionId: String): Boolean = count(auctionId) > 0
}