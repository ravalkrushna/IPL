package com.example.ipl_backend.service

import com.example.ipl_backend.dto.*
import com.example.ipl_backend.exception.AuctionNotFoundException
import com.example.ipl_backend.exception.InvalidAuctionStateException
import com.example.ipl_backend.model.*
import com.example.ipl_backend.repository.AuctionRepository
import org.springframework.stereotype.Service
import java.time.Instant
import java.util.*

@Service
class AuctionService(
    private val auctionRepository: AuctionRepository,
    private val auctionEngineService: AuctionEngineService,
    private val auctionTimerService: AuctionTimerService,
) {

    fun create(request: CreateAuctionRequest): Auction {
        val now = Instant.now().toEpochMilli()
        val auction = Auction(
            id        = UUID.randomUUID().toString(),
            name      = request.name,
            status    = AuctionStatus.PRE_AUCTION,
            createdAt = now,
            updatedAt = now
        )
        auctionRepository.save(auction)
        return auction
    }

    fun updateStatus(id: String, request: UpdateAuctionStatusRequest): Auction {
        val auction = auctionRepository.findById(id)
            ?: throw AuctionNotFoundException("Auction not found")

        if (request.status == AuctionStatus.LIVE) {
            val active = auctionRepository.findActiveAuction()
            if (active != null && active.id != id) {
                throw InvalidAuctionStateException("Another auction already LIVE")
            }
            println("🚀 Auction LIVE → Loading first player")
            auctionEngineService.loadNextPlayer(id)
        }

        auctionRepository.updateStatus(id, request.status)
        return auctionRepository.findById(id)
            ?: throw AuctionNotFoundException("Auction not found after update")
    }

    /** Admin: pause the running auction — stops the countdown timer. */
    fun pause(id: String): Auction {
        val auction = auctionRepository.findById(id)
            ?: throw AuctionNotFoundException("Auction not found")

        if (auction.status != AuctionStatus.LIVE) {
            throw InvalidAuctionStateException("Auction is not LIVE — cannot pause")
        }

        auctionTimerService.pauseTimer(id)
        auctionRepository.updateStatus(id, AuctionStatus.PAUSED)

        println("⏸ Auction $id paused by admin")
        return auctionRepository.findById(id)!!
    }

    /** Admin: resume a paused auction — restarts the countdown from where it stopped. */
    fun resume(id: String): Auction {
        val auction = auctionRepository.findById(id)
            ?: throw AuctionNotFoundException("Auction not found")

        if (auction.status != AuctionStatus.PAUSED) {
            throw InvalidAuctionStateException("Auction is not PAUSED — cannot resume")
        }

        auctionRepository.updateStatus(id, AuctionStatus.LIVE)
        auctionTimerService.resumeTimer(id)

        println("▶️ Auction $id resumed by admin")
        return auctionRepository.findById(id)!!
    }

    /** Admin: end the auction immediately regardless of remaining players. */
    fun end(id: String): Auction {
        val auction = auctionRepository.findById(id)
            ?: throw AuctionNotFoundException("Auction not found")

        if (auction.status == AuctionStatus.COMPLETED) {
            throw InvalidAuctionStateException("Auction is already completed")
        }

        // Cancel any running timer
        auctionTimerService.pauseTimer(id)

        auctionRepository.updateStatus(id, AuctionStatus.COMPLETED)

        println("🏁 Auction $id ended by admin")
        return auctionRepository.findById(id)!!
    }

    fun getById(id: String): Auction =
        auctionRepository.findById(id)
            ?: throw AuctionNotFoundException("Auction not found")

    fun list(): List<Auction> =
        auctionRepository.findAll()

    fun getActiveAuction(): Auction? =
        auctionRepository.findActiveAuction()
}