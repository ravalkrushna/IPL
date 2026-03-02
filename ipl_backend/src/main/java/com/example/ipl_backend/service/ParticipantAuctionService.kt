package com.example.ipl_backend.service

import com.example.ipl_backend.model.Participant
import com.example.ipl_backend.model.Squad
import com.example.ipl_backend.repository.ParticipantRepository
import com.example.ipl_backend.repository.SquadRepository
import com.example.ipl_backend.repository.WalletRepository
import org.jetbrains.exposed.sql.transactions.transaction
import org.springframework.stereotype.Service
import java.time.Instant
import java.util.UUID

@Service
class ParticipantAuctionService(
    private val participantRepository: ParticipantRepository,
    private val squadRepository: SquadRepository,
    private val walletRepository: WalletRepository
) {

    fun addParticipantToAuction(
        auctionId: String,
        participantId: UUID?,
        newParticipantName: String?
    ) {
        require(participantId != null || !newParticipantName.isNullOrBlank()) {
            "Either participantId or newParticipantName must be provided"
        }

        transaction {
            val resolvedId: UUID = when {

                // Existing participant
                participantId != null -> {
                    participantRepository.findById(participantId)
                        ?: throw RuntimeException("Participant not found")

                    // Check not already in this auction
                    val existing = squadRepository.findByParticipantAndAuction(participantId, auctionId)
                    if (existing != null) throw RuntimeException("Participant already in this auction")

                    participantId
                }

                // Brand new participant
                else -> {
                    val now   = Instant.now().toEpochMilli()
                    val newId = UUID.randomUUID()
                    participantRepository.save(
                        Participant(
                            id        = newId,
                            userId    = null,
                            name      = newParticipantName!!,
                            createdAt = now,
                            updatedAt = now
                        )
                    )
                    newId
                }
            }

            val now = Instant.now().toEpochMilli()

            // Create wallet (100Cr)
            walletRepository.createForAllParticipants(auctionId, listOf(resolvedId))

            // Create squad
            squadRepository.save(
                Squad(
                    id            = UUID.randomUUID().toString(),
                    participantId = resolvedId,
                    auctionId     = auctionId,
                    name          = when {
                        participantId != null -> participantRepository.findById(participantId)!!.name
                        else                 -> newParticipantName!!
                    },
                    createdAt     = now
                )
            )
        }
    }
}