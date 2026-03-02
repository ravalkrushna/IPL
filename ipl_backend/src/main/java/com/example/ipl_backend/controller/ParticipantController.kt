package com.example.ipl_backend.controller

import com.example.ipl_backend.dto.AddParticipantToAuctionRequest
import com.example.ipl_backend.service.ParticipantAuctionService
import com.example.ipl_backend.repository.ParticipantRepository
import com.example.ipl_backend.dto.ParticipantResponse
import com.example.ipl_backend.repository.SquadRepository
import com.example.ipl_backend.repository.WalletRepository
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import java.util.UUID

@RestController
@RequestMapping("/api/v1/participants")
class ParticipantController(
    private val participantRepository: ParticipantRepository,
    private val participantAuctionService: ParticipantAuctionService,
    private val squadRepository: SquadRepository,
    private val walletRepository: WalletRepository
) {

    /** All global participants — for the search dialog */
    @GetMapping
    fun getAllParticipants(): ResponseEntity<List<ParticipantResponse>> {
        val participants = participantRepository.findAll()
        return ResponseEntity.ok(participants.map {
            ParticipantResponse(id = it.id, name = it.name)
        })
    }

    /** Add participant to auction — creates squad + wallet */
    @PostMapping("/auction/{auctionId}")
    fun addToAuction(
        @PathVariable auctionId: String,
        @RequestBody request: AddParticipantToAuctionRequest
    ): ResponseEntity<Map<String, String>> {
        participantAuctionService.addParticipantToAuction(
            auctionId          = auctionId,
            participantId      = request.participantId,
            newParticipantName = request.newParticipantName
        )
        return ResponseEntity.ok(mapOf("message" to "Participant added to auction"))
    }

    /** Participants already in a specific auction (for hammer dropdown) */
    @GetMapping("/auction/{auctionId}")
    fun getParticipantsInAuction(
        @PathVariable auctionId: String
    ): ResponseEntity<List<ParticipantResponse>> {
        val squads = squadRepository.findByAuction(auctionId)
        val result = squads.mapNotNull { squad ->
            val participant = participantRepository.findById(squad.participantId) ?: return@mapNotNull null
            val wallet      = walletRepository.findByParticipantAndAuction(squad.participantId, auctionId)
            ParticipantResponse(
                id            = participant.id,
                name          = participant.name,
                walletBalance = wallet?.balance
            )
        }
        return ResponseEntity.ok(result)
    }
}