package com.example.ipl_backend.service

import com.example.ipl_backend.dto.CreateAuctionRequest
import com.example.ipl_backend.dto.UpdateAuctionRequest
import com.example.ipl_backend.exception.AuctionNotFoundException
import com.example.ipl_backend.exception.InvalidAuctionStateException
import com.example.ipl_backend.model.Auction
import com.example.ipl_backend.model.AuctionStatus
import com.example.ipl_backend.repository.AuctionRepository
import com.example.ipl_backend.repository.ParticipantRepository
import com.example.ipl_backend.repository.PlayerRepository
import com.example.ipl_backend.repository.WalletRepository
import org.springframework.stereotype.Service
import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

@Service
class AuctionService(
    private val auctionRepository: AuctionRepository,
    private val auctionPoolService: AuctionPoolService,
    private val auctionTimerService: AuctionTimerService,
    private val participantRepository: ParticipantRepository,
    private val walletRepository: WalletRepository,
    private val playerRepository: PlayerRepository,
    private val auctionEngineService: AuctionEngineService
) {

    fun create(request: CreateAuctionRequest): Auction {
        val now = Instant.now().toEpochMilli()
        val auction = Auction(
            id                = UUID.randomUUID().toString(),
            name              = request.name,
            status            = AuctionStatus.PRE_AUCTION,
            analysisTimerSecs = request.analysisTimerSecs ?: 30,
            minBidIncrement   = request.minBidIncrement ?: BigDecimal("500000.00"),
            createdAt         = now,
            updatedAt         = now
        )
        auctionRepository.save(auction)

        // Auto-create pools based on player specialisms in DB
        auctionPoolService.createDefaultPools(auction.id)

        // Create 100CR wallet for every existing participant
        val allParticipantIds = participantRepository.findAllIds()
        walletRepository.createForAllParticipants(auction.id, allParticipantIds)
        println("💰 Created ${allParticipantIds.size} wallets of 100CR for auction=${auction.id}")

        return auction
    }

    fun update(id: String, request: UpdateAuctionRequest): Auction {
        auctionRepository.findById(id) ?: throw AuctionNotFoundException("Auction not found")
        auctionRepository.update(
            id                = id,
            name              = request.name,
            analysisTimerSecs = request.analysisTimerSecs,
            minBidIncrement   = request.minBidIncrement
        )
        return auctionRepository.findById(id)!!
    }

    fun updateStatus(id: String, status: AuctionStatus): Auction {
        auctionRepository.findById(id)
            ?: throw AuctionNotFoundException("Auction not found")

        auctionRepository.updateStatus(id, status)

        if (status == AuctionStatus.LIVE) {
            playerRepository.resetAllPlayers()
            auctionEngineService.resetForNewAuction(id)
            println("🔄 All players reset and engine state cleared for auction=$id")
            println("🚀 Auction $id is now LIVE — admin must activate a pool to begin")
        }

        return auctionRepository.findById(id)!!
    }

    fun pause(id: String): Auction {
        val auction = auctionRepository.findById(id)
            ?: throw AuctionNotFoundException("Auction not found")
        if (auction.status != AuctionStatus.LIVE)
            throw InvalidAuctionStateException("Auction is not LIVE")

        auctionTimerService.cancelAllForAuction(id)
        auctionRepository.updateStatus(id, AuctionStatus.PAUSED)
        println("⏸ Auction $id paused")
        return auctionRepository.findById(id)!!
    }

    fun resume(id: String): Auction {
        val auction = auctionRepository.findById(id)
            ?: throw AuctionNotFoundException("Auction not found")
        if (auction.status != AuctionStatus.PAUSED)
            throw InvalidAuctionStateException("Auction is not PAUSED")

        auctionRepository.updateStatus(id, AuctionStatus.LIVE)
        println("▶️ Auction $id resumed")
        return auctionRepository.findById(id)!!
    }

    fun end(id: String): Auction {
        auctionRepository.findById(id) ?: throw AuctionNotFoundException("Auction not found")
        auctionTimerService.cancelAllForAuction(id)
        auctionRepository.updateStatus(id, AuctionStatus.COMPLETED)
        println("🏁 Auction $id ended")
        return auctionRepository.findById(id)!!
    }

    fun getById(id: String): Auction =
        auctionRepository.findById(id) ?: throw AuctionNotFoundException("Auction not found")

    fun list(): List<Auction> =
        auctionRepository.findAll()

    fun delete(id: String) {
        auctionRepository.findById(id) ?: throw AuctionNotFoundException("Auction not found")
        auctionTimerService.cancelAllForAuction(id)
        auctionRepository.delete(id)
    }
}