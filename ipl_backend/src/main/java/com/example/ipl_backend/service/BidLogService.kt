package com.example.ipl_backend.service

import com.example.ipl_backend.dto.BidLogResponse
import com.example.ipl_backend.model.BidLog
import com.example.ipl_backend.model.BidType
import com.example.ipl_backend.repository.BidLogRepository
import org.springframework.stereotype.Service
import java.math.BigDecimal
import java.util.UUID

@Service
class BidLogService(
    private val bidLogRepository: BidLogRepository
) {

    fun logBid(
        auctionId: String,
        playerId: String?,
        participantId: UUID? = null,
        participantName: String? = null,
        squadName: String? = null,
        amount: BigDecimal? = null,
        bidType: BidType
    ) {
        bidLogRepository.save(
            auctionId       = auctionId,
            playerId        = playerId,
            participantId   = participantId,
            participantName = participantName,
            squadName       = squadName,
            amount          = amount,
            bidType         = bidType
        )
    }

    fun getByAuction(auctionId: String): List<BidLogResponse> =
        bidLogRepository.findByAuction(auctionId).map { it.toResponse() }

    fun getByPlayer(auctionId: String, playerId: String): List<BidLogResponse> =
        bidLogRepository.findByPlayer(auctionId, playerId).map { it.toResponse() }

    fun getAll(): List<BidLogResponse> =
        bidLogRepository.findAll().map { it.toResponse() }

    fun delete(id: UUID) =
        bidLogRepository.delete(id)

    private fun BidLog.toResponse() = BidLogResponse(
        id              = id,
        auctionId       = auctionId,
        playerId        = playerId,
        participantId   = participantId,
        participantName = participantName,
        squadName       = squadName,
        amount          = amount,
        bidType         = bidType.name,
        createdAt       = createdAt
    )
}