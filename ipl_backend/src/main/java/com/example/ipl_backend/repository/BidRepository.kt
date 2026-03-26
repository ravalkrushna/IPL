package com.example.ipl_backend.repository

import com.example.ipl_backend.model.*
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.inList
import org.jetbrains.exposed.sql.transactions.transaction
import org.springframework.stereotype.Repository

@Repository
class BidRepository {

    private fun ResultRow.toBid(): Bid =
        Bid(
            id = this[Bids.id],
            playerId = this[Bids.playerId],
            participantId = this[Bids.participantId],
            auctionId = this[Bids.auctionId],
            amount = this[Bids.amount],
            createdAt = this[Bids.createdAt]
        )

    fun save(bid: Bid) {

        Bids.insert {
            it[id] = bid.id
            it[playerId] = bid.playerId
            it[participantId] = bid.participantId
            it[auctionId] = bid.auctionId
            it[amount] = bid.amount
            it[createdAt] = bid.createdAt
        }
    }

    fun findHighestBid(playerId: String, auctionId: String): Bid? =
        transaction {
            Bids.selectAll()
                .where {
                    (Bids.playerId eq playerId) and
                            (Bids.auctionId eq auctionId)
                }
                .orderBy(Bids.amount to SortOrder.DESC)
                .limit(1)
                .map { it.toBid() }
                .singleOrNull()
        }

    fun highestBidForUpdate(playerId: String, auctionId: String): Bid? =
        Bids.selectAll()
            .where {
                (Bids.playerId eq playerId) and
                        (Bids.auctionId eq auctionId)
            }
            .orderBy(Bids.amount to SortOrder.DESC)
            .forUpdate()
            .limit(1)
            .map { it.toBid() }
            .singleOrNull()

    fun findHistory(playerId: String, auctionId: String): List<Bid> =
        transaction {
            Bids.selectAll()
                .where {
                    (Bids.playerId eq playerId) and
                            (Bids.auctionId eq auctionId)
                }
                .orderBy(Bids.createdAt to SortOrder.ASC)
                .map { it.toBid() }
        }

    /** Clears round-1 (or prior) bids so an unsold player can be bid on again in a later round. */
    fun deleteForPlayersInAuction(playerIds: List<String>, auctionId: String) {
        if (playerIds.isEmpty()) return
        transaction {
            Bids.deleteWhere {
                (Bids.auctionId eq auctionId) and (Bids.playerId inList playerIds)
            }
        }
    }
}