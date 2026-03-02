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
     * Auto-creates the four standard pools for a new auction.
     * Called by AuctionService on auction creation.
     */
    fun createDefaultPools(auctionId: String) {
        val now = Instant.now().toEpochMilli()
        val poolTypes = listOf(
            PoolType.BATSMAN      to 1,
            PoolType.BOWLER       to 2,
            PoolType.ALLROUNDER   to 3,
            PoolType.WICKETKEEPER to 4
        )
        poolTypes.forEach { (poolType, order) ->
            val playerCount = playerRepository.countBySpecialism(poolType.name)
            if (playerCount > 0) {
                val existing = auctionPoolRepository.findByAuctionAndType(auctionId, poolType)
                if (existing == null) {
                    auctionPoolRepository.save(
                        AuctionPool(
                            id            = UUID.randomUUID(),
                            auctionId     = auctionId,
                            poolType      = poolType,
                            status        = PoolStatus.PENDING,
                            sequenceOrder = order,
                            createdAt     = now,
                            updatedAt     = now
                        )
                    )
                    println("✅ Pool ${poolType.name} created for auction=$auctionId ($playerCount players)")
                }
            } else {
                println("⚠️ Skipping pool ${poolType.name} — no players with that specialism")
            }
        }
    }

    /**
     * Admin ACTIVATES a pool — starts it (PENDING→ACTIVE) or resumes it (PAUSED→ACTIVE).
     * Frontend will pick up the new pool status on next /engine/state poll.
     */
    fun activatePool(auctionId: String, poolType: PoolType): AuctionPool {
        val currentlyActive = auctionPoolRepository.findActivePool(auctionId)
        if (currentlyActive != null && currentlyActive.poolType != poolType) {
            throw InvalidAuctionStateException(
                "Pool ${currentlyActive.poolType} is currently ACTIVE. " +
                        "Pause or complete it before starting $poolType."
            )
        }

        val pool = auctionPoolRepository.findByAuctionAndType(auctionId, poolType)
            ?: throw InvalidAuctionStateException("Pool $poolType not found for auction $auctionId")

        when (pool.status) {
            PoolStatus.COMPLETED ->
                throw InvalidAuctionStateException(
                    "Pool $poolType is COMPLETED and cannot be restarted."
                )
            PoolStatus.ACTIVE ->
                throw InvalidAuctionStateException("Pool $poolType is already ACTIVE.")
            PoolStatus.PENDING, PoolStatus.PAUSED -> {
                val action = if (pool.status == PoolStatus.PAUSED) "RESUMED" else "STARTED"
                auctionPoolRepository.updateStatus(pool.id, PoolStatus.ACTIVE)
                bidLogRepository.save(auctionId = auctionId, playerId = "system", bidType = BidType.POOL_STARTED)
                println("🏊 Pool ${poolType.name} $action for auction=$auctionId")
            }
        }

        return auctionPoolRepository.findById(pool.id)!!
    }

    /**
     * Admin PAUSES the current active pool.
     * Frontend will see activePool=null on next poll.
     */
    fun pausePool(auctionId: String): AuctionPool {
        val activePool = auctionPoolRepository.findActivePool(auctionId)
            ?: throw InvalidAuctionStateException("No ACTIVE pool to pause for auction $auctionId")

        auctionPoolRepository.updateStatus(activePool.id, PoolStatus.PAUSED)
        bidLogRepository.save(auctionId = auctionId, playerId = "system", bidType = BidType.POOL_ENDED)
        println("⏸ Pool ${activePool.poolType.name} PAUSED for auction=$auctionId")

        return auctionPoolRepository.findById(activePool.id)!!
    }

    /**
     * Admin COMPLETES the current active or paused pool — permanent, irreversible.
     */
    fun completePool(auctionId: String): AuctionPool {
        val pool = auctionPoolRepository.findActivePool(auctionId)
            ?: auctionPoolRepository.findByAuction(auctionId).firstOrNull { it.status == PoolStatus.PAUSED }
            ?: throw InvalidAuctionStateException("No ACTIVE or PAUSED pool to complete for auction $auctionId")

        auctionPoolRepository.updateStatus(pool.id, PoolStatus.COMPLETED)
        bidLogRepository.save(auctionId = auctionId, playerId = "system", bidType = BidType.POOL_ENDED)
        println("🏁 Pool ${pool.poolType.name} COMPLETED for auction=$auctionId")

        return auctionPoolRepository.findById(pool.id)!!
    }

    fun getPoolsForAuction(auctionId: String): List<PoolResponse> =
        auctionPoolRepository.findByAuction(auctionId).map { pool ->
            val playerCount    = playerRepository.countBySpecialism(pool.poolType.name)
            val auctionedCount = playerRepository.countAuctionedBySpecialism(pool.poolType.name)
            PoolResponse(
                id             = pool.id,
                auctionId      = pool.auctionId,
                poolType       = pool.poolType.name,
                status         = pool.status.name,
                sequenceOrder  = pool.sequenceOrder,
                totalPlayers   = playerCount,
                auctionedCount = auctionedCount,
                remaining      = playerCount - auctionedCount
            )
        }

    fun getActivePool(auctionId: String): AuctionPool? =
        auctionPoolRepository.findActivePool(auctionId)

    fun deletePool(id: UUID) =
        auctionPoolRepository.delete(id)
}