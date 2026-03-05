package com.example.ipl_backend.service

import com.example.ipl_backend.dto.PoolResponse
import com.example.ipl_backend.exception.InvalidAuctionStateException
import com.example.ipl_backend.model.*
import com.example.ipl_backend.repository.AuctionPoolRepository
import com.example.ipl_backend.repository.BidLogRepository
import com.example.ipl_backend.repository.PlayerRepository
import org.springframework.stereotype.Service
import java.time.Instant
import java.util.UUID

@Service
class AuctionPoolService(
    private val auctionPoolRepository: AuctionPoolRepository,
    private val playerRepository: PlayerRepository,
    private val bidLogRepository: BidLogRepository
) {

    /**
     * Creates a single ALL pool for the auction.
     * Called by AuctionService on auction creation.
     */
    fun createDefaultPools(auctionId: String) {
        val now          = Instant.now().toEpochMilli()
        val playerCount  = playerRepository.countAll()

        if (playerCount > 0) {
            val existing = auctionPoolRepository.findByAuctionAndType(auctionId, PoolType.ALL)
            if (existing == null) {
                auctionPoolRepository.save(
                    AuctionPool(
                        id            = UUID.randomUUID(),
                        auctionId     = auctionId,
                        poolType      = PoolType.ALL,
                        status        = PoolStatus.PENDING,
                        sequenceOrder = 1,
                        createdAt     = now,
                        updatedAt     = now
                    )
                )
                println("✅ ALL pool created for auction=$auctionId ($playerCount players)")
            }
        } else {
            println("⚠️ Skipping pool creation — no players found")
        }
    }

    fun activatePool(auctionId: String, poolType: PoolType): AuctionPool {
        val currentlyActive = auctionPoolRepository.findActivePool(auctionId)
        if (currentlyActive != null && currentlyActive.poolType != poolType) {
            throw InvalidAuctionStateException(
                "A pool is currently ACTIVE. Pause it before activating another."
            )
        }

        val pool = auctionPoolRepository.findByAuctionAndType(auctionId, poolType)
            ?: throw InvalidAuctionStateException("Pool $poolType not found for auction $auctionId")

        when (pool.status) {
            PoolStatus.COMPLETED ->
                throw InvalidAuctionStateException("Pool is COMPLETED and cannot be restarted.")
            PoolStatus.ACTIVE ->
                throw InvalidAuctionStateException("Pool is already ACTIVE.")
            PoolStatus.PENDING, PoolStatus.PAUSED -> {
                val action = if (pool.status == PoolStatus.PAUSED) "RESUMED" else "STARTED"
                auctionPoolRepository.updateStatus(pool.id, PoolStatus.ACTIVE)
                bidLogRepository.save(auctionId = auctionId, playerId = null, bidType = BidType.POOL_STARTED)
                println("🏊 Pool $action for auction=$auctionId")
            }
        }

        return auctionPoolRepository.findById(pool.id)!!
    }

    fun pausePool(auctionId: String): AuctionPool {
        val activePool = auctionPoolRepository.findActivePool(auctionId)
            ?: throw InvalidAuctionStateException("No ACTIVE pool to pause for auction $auctionId")

        auctionPoolRepository.updateStatus(activePool.id, PoolStatus.PAUSED)
        bidLogRepository.save(auctionId = auctionId, playerId = null, bidType = BidType.POOL_ENDED)
        println("⏸ Pool PAUSED for auction=$auctionId")

        return auctionPoolRepository.findById(activePool.id)!!
    }

    fun completePool(auctionId: String): AuctionPool {
        val pool = auctionPoolRepository.findActivePool(auctionId)
            ?: auctionPoolRepository.findByAuction(auctionId).firstOrNull { it.status == PoolStatus.PAUSED }
            ?: throw InvalidAuctionStateException("No ACTIVE or PAUSED pool to complete for auction $auctionId")

        auctionPoolRepository.updateStatus(pool.id, PoolStatus.COMPLETED)
        bidLogRepository.save(auctionId = auctionId, playerId = null, bidType = BidType.POOL_ENDED)
        println("🏁 Pool COMPLETED for auction=$auctionId")

        return auctionPoolRepository.findById(pool.id)!!
    }

    fun getPoolsForAuction(auctionId: String): List<PoolResponse> =
        auctionPoolRepository.findByAuction(auctionId).map { pool ->
            val totalPlayers   = playerRepository.countAll()
            val auctionedCount = playerRepository.countAuctioned()
            PoolResponse(
                id             = pool.id,
                auctionId      = pool.auctionId,
                poolType       = pool.poolType.name,
                status         = pool.status.name,
                sequenceOrder  = pool.sequenceOrder,
                totalPlayers   = totalPlayers,
                auctionedCount = auctionedCount,
                remaining      = totalPlayers - auctionedCount
            )
        }

    fun getActivePool(auctionId: String): AuctionPool? =
        auctionPoolRepository.findActivePool(auctionId)

    fun deletePool(id: UUID) =
        auctionPoolRepository.delete(id)
}