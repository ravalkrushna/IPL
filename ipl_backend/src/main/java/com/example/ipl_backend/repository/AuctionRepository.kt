package com.example.ipl_backend.repository

import com.example.ipl_backend.model.*
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.neq
import org.jetbrains.exposed.sql.transactions.transaction
import org.springframework.stereotype.Repository
import java.math.BigDecimal
import java.time.Instant

@Repository
class AuctionRepository {

    private fun ResultRow.toAuction(): Auction =
        Auction(
            id                = this[Auctions.id],
            name              = this[Auctions.name],
            status            = this[Auctions.status],
            analysisTimerSecs = this[Auctions.analysisTimerSecs],
            minBidIncrement   = this[Auctions.minBidIncrement],
            reauctionStarted  = this[Auctions.reauctionStarted],
            reauctionStartedAt = this[Auctions.reauctionStartedAt],
            createdAt         = this[Auctions.createdAt],
            updatedAt         = this[Auctions.updatedAt]
        )

    fun save(auction: Auction) {
        transaction {
            Auctions.insert {
                it[id]                = auction.id
                it[name]              = auction.name
                it[status]            = auction.status
                it[analysisTimerSecs] = auction.analysisTimerSecs
                it[minBidIncrement]   = auction.minBidIncrement
                it[reauctionStarted]  = auction.reauctionStarted
                it[reauctionStartedAt]= auction.reauctionStartedAt
                it[createdAt]         = auction.createdAt
                it[updatedAt]         = auction.updatedAt
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

    // Now returns ALL live auctions (multiple auctions can run simultaneously)
    fun findAllActive(): List<Auction> =
        transaction {
            Auctions.selectAll()
                .where { Auctions.status eq AuctionStatus.LIVE }
                .map { it.toAuction() }
        }

    // Returns IDs of all non-completed auctions — used for wallet creation on signup
    fun findAllActiveIds(): List<String> =
        transaction {
            Auctions.select(Auctions.id)
                .where { Auctions.status neq AuctionStatus.COMPLETED }
                .map { it[Auctions.id] }
        }

    fun updateStatus(id: String, status: AuctionStatus) {
        transaction {
            Auctions.update({ Auctions.id eq id }) {
                it[Auctions.status] = status
                it[updatedAt]       = Instant.now().toEpochMilli()
            }
        }
    }

    fun update(id: String, name: String, analysisTimerSecs: Int, minBidIncrement: BigDecimal) {
        transaction {
            Auctions.update({ Auctions.id eq id }) {
                it[Auctions.name]              = name
                it[Auctions.analysisTimerSecs] = analysisTimerSecs
                it[Auctions.minBidIncrement]   = minBidIncrement
                it[updatedAt]                  = Instant.now().toEpochMilli()
            }
        }
    }

    fun delete(id: String) {
        transaction {
            Auctions.deleteWhere { Auctions.id eq id }
        }
    }

    fun markReauctionStarted(id: String, startedAt: Long) {
        transaction {
            Auctions.update({ Auctions.id eq id }) {
                it[reauctionStarted] = true
                it[reauctionStartedAt] = startedAt
                it[updatedAt] = startedAt
            }
        }
    }
}