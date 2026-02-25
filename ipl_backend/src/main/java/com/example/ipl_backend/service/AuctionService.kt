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
    private val auctionEngineService: AuctionEngineService   // ✅ CORRECT
) {

    fun create(request: CreateAuctionRequest): Auction {

        val now = Instant.now().toEpochMilli()

        val auction = Auction(
            id = UUID.randomUUID().toString(),
            name = request.name,
            status = AuctionStatus.PRE_AUCTION,
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

            val activeAuction = auctionRepository.findActiveAuction()

            if (activeAuction != null && activeAuction.id != id) {
                throw InvalidAuctionStateException("Another auction already LIVE")
            }

            println("🚀 Auction LIVE → Loading first player")

            auctionEngineService.loadNextPlayer(id)   // 🔥 CRITICAL BOOTSTRAP
        }

        auctionRepository.updateStatus(id, request.status)

        return auctionRepository.findById(id)
            ?: throw AuctionNotFoundException("Auction not found after update")
    }

    fun getById(id: String): Auction =
        auctionRepository.findById(id)
            ?: throw AuctionNotFoundException("Auction not found")

    fun list(): List<Auction> =
        auctionRepository.findAll()

    fun getActiveAuction(): Auction? =
        auctionRepository.findActiveAuction()
}