package com.example.ipl_backend.service

import org.springframework.stereotype.Service
import java.util.concurrent.ConcurrentHashMap

/**
 * Tracks connected WebSocket sessions per PLAYER topic.
 *
 * The frontend subscribes to /topic/auction/{playerId}, so presence
 * is tracked by playerId — NOT auctionId.
 */
@Service
class ParticipantPresenceService {

    // playerId → set of sessionIds currently subscribed to that player topic
    private val sessions = ConcurrentHashMap<String, MutableSet<String>>()

    fun onConnect(playerId: String, sessionId: String) {
        sessions.computeIfAbsent(playerId) { ConcurrentHashMap.newKeySet() }.add(sessionId)
        println("👤 +connect  player=$playerId session=$sessionId total=${count(playerId)}")
    }

    fun onDisconnect(playerId: String, sessionId: String) {
        sessions[playerId]?.remove(sessionId)
        println("👤 -disconnect player=$playerId session=$sessionId total=${count(playerId)}")
    }

    /**
     * Removes sessionId from whatever player topic it was in.
     * Returns the playerId it was found under, or null.
     */
    fun removeSession(sessionId: String): String? {
        for ((playerId, set) in sessions) {
            if (set.remove(sessionId)) {
                println("👤 -disconnect (by session) player=$playerId session=$sessionId total=${count(playerId)}")
                return playerId
            }
        }
        return null
    }

    fun count(playerId: String): Int = sessions[playerId]?.size ?: 0

    fun hasParticipants(playerId: String): Boolean = count(playerId) > 0

    fun clearPlayer(playerId: String) = sessions.remove(playerId)
}