package com.example.ipl_backend.service

import com.example.ipl_backend.dto.*
import com.example.ipl_backend.exception.SquadAlreadyExistsException
import com.example.ipl_backend.exception.SquadNotFoundException
import com.example.ipl_backend.model.*
import com.example.ipl_backend.repository.SquadRepository
import org.springframework.stereotype.Service
import java.time.Instant
import java.util.*

@Service
class SquadService(
    private val squadRepository: SquadRepository
) {

    fun findMySquad(
        participantId: UUID,
        auctionId: String
    ): Squad? {
        return squadRepository.findByParticipantAndAuction(participantId, auctionId)
    }

    fun create(request: CreateSquadRequest): Squad {
        val existingSquad = squadRepository
            .findByParticipantAndAuction(request.participantId, request.auctionId)

        if (existingSquad != null) {
            throw SquadAlreadyExistsException("Squad already exists for participant")
        }

        val squad = Squad(
            id = UUID.randomUUID().toString(),
            participantId = request.participantId,
            auctionId = request.auctionId,
            name = request.name,
            createdAt = Instant.now().toEpochMilli()
        )

        squadRepository.save(squad)

        return squad
    }

    fun getSquad(squadId: String): SquadResponse {
        val squad = squadRepository.findById(squadId)
            ?: throw SquadNotFoundException("Squad not found")

        val players = squadRepository.getPlayers(squadId)

        return SquadResponse(
            squadId = squad.id,
            participantId = squad.participantId,
            players = players
        )
    }

    fun findMySquadWithPlayers(
        participantId: UUID,
        auctionId: String
    ): MySquadResponse? {
        val squad = squadRepository.findByParticipantAndAuction(participantId, auctionId)
            ?: return null

        val players = squadRepository.getSquadPlayers(participantId, auctionId)

        return MySquadResponse(
            squadId = squad.id,
            name = squad.name,
            participantId = squad.participantId,
            players = players
        )
    }

    fun findAllSquadsWithPlayers(auctionId: String): List<MySquadResponse> {
        return squadRepository.findAllByAuction(auctionId).map { squad ->
            val players = squadRepository.getSquadPlayersBySquadId(squad.id)
            MySquadResponse(
                squadId = squad.id,
                name = squad.name,
                participantId = squad.participantId,
                players = players
            )
        }
    }
}