package com.example.ipl_backend.repository

import com.example.ipl_backend.model.*
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import org.springframework.stereotype.Repository

@Repository
class AuctionRepository {

    private fun ResultRow.toAuction(): Auction {
        return Auction(
            id = this[Auctions.id],
            name = this[Auctions.name],
            status = this[Auctions.status],   // ✅ Already enum
            createdAt = this[Auctions.createdAt],
            updatedAt = this[Auctions.updatedAt]
        )
    }

    fun save(auction: Auction) {
        transaction {
            Auctions.insert {
                it[id] = auction.id
                it[name] = auction.name
                it[status] = auction.status   // ✅ FIXED
                it[createdAt] = auction.createdAt
                it[updatedAt] = auction.updatedAt
            }
        }
    }

    fun findById(id: String): Auction? =
        transaction {
            Auctions.selectAll()
                .where { Auctions.id eq id }
                .firstOrNull()
                ?.toAuction()
        }

    fun findAll(): List<Auction> =
        transaction {
            Auctions.selectAll()
                .orderBy(Auctions.createdAt to SortOrder.DESC)
                .map { it.toAuction() }
        }

    fun findActiveAuction(): Auction? =
        transaction {
            Auctions.selectAll()
                .where { Auctions.status eq AuctionStatus.LIVE }   // ✅ FIXED
                .firstOrNull()
                ?.toAuction()
        }

    fun updateStatus(id: String, status: AuctionStatus) {
        transaction {
            Auctions.update({ Auctions.id eq id }) {
                it[Auctions.status] = status   // ✅ FIXED
                it[updatedAt] = System.currentTimeMillis()
            }
        }
    }
}