package com.example.ipl_backend.service

import com.example.ipl_backend.exception.ParticipantNotFoundException
import com.example.ipl_backend.model.Participant
import com.example.ipl_backend.repository.ParticipantRepository
import org.springframework.stereotype.Service
import java.time.Instant
import java.util.UUID

@Service
class ParticipantService(
    private val participantRepository: ParticipantRepository
) {
    // NOTE: Wallet creation is now handled by AuctionService (on auction create)
    // and AuthService (on signup) — NOT here. Wallets are per-auction, not per-participant.

    fun create(name: String, userId: UUID): Participant {

        if (participantRepository.existsByName(name)) {
            throw RuntimeException("Participant with name '$name' already exists")
        }

        val now = Instant.now().toEpochMilli()

        val participant = Participant(
            id        = UUID.randomUUID(),
            userId    = userId,
            name      = name,
            createdAt = now,
            updatedAt = now
        )

        participantRepository.save(participant)
        return participant
    }

    fun getById(id: UUID): Participant =
        participantRepository.findById(id)
            ?: throw ParticipantNotFoundException("Participant not found")

    // Alias used by controllers/services that call findById
    fun findById(id: UUID): Participant? =
        participantRepository.findById(id)

    fun findAll(): List<Participant> =
        participantRepository.findAll()

    // Alias for controllers that call list()
    fun list(): List<Participant> =
        participantRepository.findAll()

    fun update(id: UUID, name: String) {
        participantRepository.findById(id)
            ?: throw ParticipantNotFoundException("Participant not found")
        participantRepository.update(id, name)
    }

    fun delete(id: UUID) {
        participantRepository.findById(id)
            ?: throw ParticipantNotFoundException("Participant not found")
        participantRepository.delete(id)
    }
}