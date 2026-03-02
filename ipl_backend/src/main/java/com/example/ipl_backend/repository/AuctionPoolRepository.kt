package com.example.ipl_backend.repository

import com.example.ipl_backend.model.*
import org.jetbrains.exposed.dao.id.EntityID
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction
import org.springframework.stereotype.Repository
import java.time.Instant
import java.util.UUID

@Repository
class AuctionPoolRepository {

    private fun ResultRow.toPool(): AuctionPool =
        AuctionPool(
            id            = this[AuctionPools.id].value,
            auctionId     = this[AuctionPools.auctionId],
            poolType      = this[AuctionPools.poolType],
            status        = this[AuctionPools.status],
            sequenceOrder = this[AuctionPools.sequenceOrder],
            createdAt     = this[AuctionPools.createdAt],
            updatedAt     = this[AuctionPools.updatedAt]
        )

    fun save(pool: AuctionPool) {
        transaction {
            AuctionPools.insert {
                it[id]            = pool.id
                it[auctionId]     = pool.auctionId
                it[poolType]      = pool.poolType
                it[status]        = pool.status
                it[sequenceOrder] = pool.sequenceOrder
                it[createdAt]     = pool.createdAt
                it[updatedAt]     = pool.updatedAt
            }
        }
    }

    fun findById(id: UUID): AuctionPool? =
        transaction {
            AuctionPools.selectAll()
                .where { AuctionPools.id eq EntityID(id, AuctionPools) }
                .map { it.toPool() }
                .singleOrNull()
        }

    fun findByAuction(auctionId: String): List<AuctionPool> =
        transaction {
            AuctionPools.selectAll()
                .where { AuctionPools.auctionId eq auctionId }
                .orderBy(AuctionPools.sequenceOrder to SortOrder.ASC)
                .map { it.toPool() }
        }

    fun findActivePool(auctionId: String): AuctionPool? =
        transaction {
            AuctionPools.selectAll()
                .where {
                    (AuctionPools.auctionId eq auctionId) and
                            (AuctionPools.status eq PoolStatus.ACTIVE)
                }
                .map { it.toPool() }
                .singleOrNull()
        }

    fun findByAuctionAndType(auctionId: String, poolType: PoolType): AuctionPool? =
        transaction {
            AuctionPools.selectAll()
                .where {
                    (AuctionPools.auctionId eq auctionId) and
                            (AuctionPools.poolType eq poolType)
                }
                .map { it.toPool() }
                .singleOrNull()
        }

    fun updateStatus(id: UUID, status: PoolStatus) {
        transaction {
            AuctionPools.update({ AuctionPools.id eq EntityID(id, AuctionPools) }) {
                it[AuctionPools.status] = status
                it[updatedAt]           = Instant.now().toEpochMilli()
            }
        }
    }

    fun delete(id: UUID) {
        transaction {
            AuctionPools.deleteWhere { AuctionPools.id eq EntityID(id, AuctionPools) }
        }
    }

    fun countByAuction(auctionId: String): Long =
        transaction {
            AuctionPools.selectAll()
                .where { AuctionPools.auctionId eq auctionId }
                .count()
        }
}