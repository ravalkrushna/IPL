package com.example.ipl_backend.service

import com.example.ipl_backend.exception.ParticipantNotFoundException
import com.example.ipl_backend.model.Participant
import com.example.ipl_backend.repository.ParticipantRepository
import com.example.ipl_backend.repository.WalletRepository
import org.springframework.stereotype.Service
import java.time.Instant
import java.util.UUID

@Service
class ParticipantService(
    private val participantRepository: ParticipantRepository,
    private val walletRepository: WalletRepository
) {

    fun create(name: String, userId: UUID): Participant {

        if (participantRepository.existsByName(name)) {
            throw RuntimeException("Participant with name already exists")
        }

        val now = Instant.now().toEpochMilli()

        val participant = Participant(
            id = UUID.randomUUID(),
            userId = userId,
            name = name,
            createdAt = now,
            updatedAt = now
        )

        participantRepository.save(participant)

        walletRepository.create(participant.id)

        return participant
    }

    fun getById(id: UUID): Participant {
        return participantRepository.findById(id)
            ?: throw ParticipantNotFoundException("Participant not found")
    }

    fun list(): List<Participant> =
        participantRepository.findAll()
}