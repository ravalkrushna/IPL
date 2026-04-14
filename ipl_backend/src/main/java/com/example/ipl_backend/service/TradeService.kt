package com.example.ipl_backend.service

import com.example.ipl_backend.dto.CreateTradeRequest
import com.example.ipl_backend.dto.CreateSellListingRequest
import com.example.ipl_backend.dto.CreateLoanRequest
import com.example.ipl_backend.dto.TradeResponse
import com.example.ipl_backend.exception.AuctionNotFoundException
import com.example.ipl_backend.exception.InvalidAuctionStateException
import com.example.ipl_backend.model.*
import com.example.ipl_backend.repository.AuctionRepository
import com.example.ipl_backend.repository.WalletRepository
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction
import org.springframework.stereotype.Service
import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

@Service
class TradeService(
    private val auctionRepository: AuctionRepository,
    private val walletRepository: WalletRepository
) {

    companion object {
        // Special sentinel value for the unsold player pool (not a real squad).
        const val UNSOLD_POOL = "__UNSOLD_POOL__"

        // Marker pattern for open sell listing rows:
        // seller squad == placeholder buyer squad, no buyer players, one-way seller->buyer cash.
        private fun isOpenSellListing(t: TradeResponse): Boolean =
            t.tradeType == TradeType.SELL &&
            t.fromSquadId == t.toSquadId &&
                t.toPlayerIds.isEmpty() &&
                t.cashFromToTo > BigDecimal.ZERO &&
                t.cashToToFrom == BigDecimal.ZERO &&
                t.fromPlayerIds.size == 1

        private fun isLoan(t: TradeResponse): Boolean =
            t.tradeType == TradeType.LOAN

        fun isUnsoldPoolTrade(t: TradeResponse): Boolean =
            t.isUnsoldPoolTrade
    }

    fun createTrade(request: CreateTradeRequest): TradeResponse {
        val auction = auctionRepository.findById(request.auctionId)
            ?: throw AuctionNotFoundException("Auction not found")
        ensureAuctionCompleted(auction)
        validateTradeRequest(request)

        val now = Instant.now().toEpochMilli()
        val id = UUID.randomUUID().toString()

        transaction {
            if (request.toSquadId == UNSOLD_POOL) {
                ensureSquadInAuction(request.auctionId, request.fromSquadId)
                ensureOwnership(request.fromSquadId, request.fromPlayerIds)
                ensurePlayersAreUnsold(request.toPlayerIds)
            } else {
                ensureSquadsInAuction(request.auctionId, request.fromSquadId, request.toSquadId)
                ensureOwnership(request.fromSquadId, request.fromPlayerIds)
                ensureOwnership(request.toSquadId, request.toPlayerIds)
            }

            val isUnsoldPool = request.toSquadId == UNSOLD_POOL
            Trades.insert {
                it[Trades.id] = id
                it[auctionId] = request.auctionId
                it[fromSquadId] = request.fromSquadId
                // Use fromSquadId as FK-safe placeholder when trading with the unsold pool.
                it[toSquadId] = if (isUnsoldPool) request.fromSquadId else request.toSquadId
                it[fromPlayerIdsCsv] = request.fromPlayerIds.joinToString(",")
                it[toPlayerIdsCsv] = request.toPlayerIds.joinToString(",")
                it[cashFromToTo] = request.cashFromToTo
                it[cashToToFrom] = request.cashToToFrom
                it[tradeType] = TradeType.TRADE
                it[Trades.isUnsoldPoolTrade] = isUnsoldPool
                it[status] = TradeStatus.PENDING
                it[createdAt] = now
                it[updatedAt] = now
            }
        }
        return getById(id)!!
    }

    fun createLoan(request: CreateLoanRequest): TradeResponse {
        if (request.playerId.isBlank()) throw IllegalArgumentException("playerId is required")
        if (request.loanFee < BigDecimal.ZERO) throw IllegalArgumentException("loanFee cannot be negative")

        val auction = auctionRepository.findById(request.auctionId)
            ?: throw AuctionNotFoundException("Auction not found")
        ensureAuctionCompleted(auction)

        val now = Instant.now().toEpochMilli()
        val id = UUID.randomUUID().toString()

        transaction {
            ensureSquadInAuction(request.auctionId, request.fromSquadId)
            ensureOwnership(request.fromSquadId, listOf(request.playerId))

            Trades.insert {
                it[Trades.id] = id
                it[auctionId] = request.auctionId
                it[fromSquadId] = request.fromSquadId
                it[toSquadId] = request.fromSquadId // placeholder until borrower selection during approval
                it[fromPlayerIdsCsv] = request.playerId
                it[toPlayerIdsCsv] = ""
                it[cashFromToTo] = BigDecimal.ZERO
                it[cashToToFrom] = request.loanFee // borrower(to) -> lender(from)
                it[tradeType] = TradeType.LOAN
                it[status] = TradeStatus.PENDING
                it[createdAt] = now
                it[updatedAt] = now
            }
        }
        return getById(id)!!
    }

    fun createSellListing(request: CreateSellListingRequest): TradeResponse {
        if (request.playerId.isBlank()) throw IllegalArgumentException("playerId is required")
        if (request.askingPrice <= BigDecimal.ZERO) throw IllegalArgumentException("askingPrice must be > 0")

        val auction = auctionRepository.findById(request.auctionId)
            ?: throw AuctionNotFoundException("Auction not found")
        ensureAuctionCompleted(auction)

        val now = Instant.now().toEpochMilli()
        val id = UUID.randomUUID().toString()

        transaction {
            ensureSquadInAuction(request.auctionId, request.fromSquadId)
            ensureOwnership(request.fromSquadId, listOf(request.playerId))

            Trades.insert {
                it[Trades.id] = id
                it[auctionId] = request.auctionId
                it[fromSquadId] = request.fromSquadId
                it[toSquadId] = request.fromSquadId // placeholder until a buyer accepts
                it[fromPlayerIdsCsv] = request.playerId
                it[toPlayerIdsCsv] = ""
                it[cashFromToTo] = request.askingPrice
                it[cashToToFrom] = BigDecimal.ZERO
                it[tradeType] = TradeType.SELL
                it[status] = TradeStatus.PENDING
                it[createdAt] = now
                it[updatedAt] = now
            }
        }
        return getById(id)!!
    }

    fun acceptTrade(tradeId: String): TradeResponse {
        transaction {
            val trade = loadTradeForUpdate(tradeId) ?: throw IllegalArgumentException("Trade not found")
            if (trade.status != TradeStatus.PENDING) throw IllegalStateException("Trade is not PENDING")
            if (isLoan(trade)) throw IllegalStateException("Use loan approval endpoint for loan offers")
            if (trade.tradeType == TradeType.SELL) throw IllegalStateException("Use sell acceptance endpoint for sell listings")

            val auction = auctionRepository.findById(trade.auctionId)
                ?: throw AuctionNotFoundException("Auction not found")
            ensureAuctionCompleted(auction)

            if (isUnsoldPoolTrade(trade)) {
                ensureSquadInAuction(trade.auctionId, trade.fromSquadId)
                ensureOwnership(trade.fromSquadId, trade.fromPlayerIds)
                ensurePlayersAreUnsold(trade.toPlayerIds)
                applyPlayerTransfersUnsoldPool(trade)
            } else {
                ensureSquadsInAuction(trade.auctionId, trade.fromSquadId, trade.toSquadId)
                ensureOwnership(trade.fromSquadId, trade.fromPlayerIds)
                ensureOwnership(trade.toSquadId, trade.toPlayerIds)
                applyWalletLegs(trade)
                applyPlayerTransfers(trade)
            }

            val now = Instant.now().toEpochMilli()
            Trades.update({ Trades.id eq tradeId }) {
                it[status] = TradeStatus.ACCEPTED
                it[updatedAt] = now
            }
        }
        return getById(tradeId)!!
    }

    fun approveLoan(tradeId: String, borrowerSquadId: String): TradeResponse {
        if (borrowerSquadId.isBlank()) throw IllegalArgumentException("borrowerSquadId is required")
        transaction {
            val loan = loadTradeForUpdate(tradeId) ?: throw IllegalArgumentException("Trade not found")
            if (loan.status != TradeStatus.PENDING) throw IllegalStateException("Loan is not PENDING")
            if (!isLoan(loan)) throw IllegalArgumentException("Trade is not a LOAN offer")
            if (loan.fromSquadId == borrowerSquadId) throw IllegalArgumentException("Lender squad cannot borrow its own loan offer")

            val auction = auctionRepository.findById(loan.auctionId)
                ?: throw AuctionNotFoundException("Auction not found")
            ensureAuctionCompleted(auction)

            ensureSquadsInAuction(loan.auctionId, loan.fromSquadId, borrowerSquadId)
            ensureOwnership(loan.fromSquadId, loan.fromPlayerIds)

            val resolved = loan.copy(toSquadId = borrowerSquadId)
            applyWalletLegs(resolved)
            applyPlayerTransfers(resolved)

            val now = Instant.now().toEpochMilli()
            Trades.update({ Trades.id eq tradeId }) {
                it[toSquadId] = borrowerSquadId
                it[status] = TradeStatus.ACCEPTED
                it[updatedAt] = now
            }
        }
        return getById(tradeId)!!
    }

    fun closeLoan(tradeId: String): TradeResponse {
        transaction {
            val loan = loadTradeForUpdate(tradeId) ?: throw IllegalArgumentException("Trade not found")
            if (!isLoan(loan)) throw IllegalArgumentException("Trade is not a LOAN offer")
            if (loan.status != TradeStatus.ACCEPTED) throw IllegalStateException("Only ACCEPTED loans can be closed")
            val playerId = loan.fromPlayerIds.firstOrNull()
                ?: throw IllegalStateException("Loan has no player")

            // On close, move player back from borrower(to) to lender(from).
            ensureOwnership(loan.toSquadId, listOf(playerId))
            val price = squadPlayerPrice(loan.toSquadId, playerId) ?: BigDecimal.ZERO
            SquadPlayers.deleteWhere { (SquadPlayers.squadId eq loan.toSquadId) and (SquadPlayers.playerId eq playerId) }
            SquadPlayers.insert {
                it[id] = UUID.randomUUID().toString()
                it[squadId] = loan.fromSquadId
                it[SquadPlayers.playerId] = playerId
                it[purchasePrice] = price
            }

            val now = Instant.now().toEpochMilli()
            Trades.update({ Trades.id eq tradeId }) {
                it[status] = TradeStatus.CLOSED
                it[updatedAt] = now
            }
        }
        return getById(tradeId)!!
    }

    fun acceptSellListing(tradeId: String, buyerSquadId: String): TradeResponse {
        if (buyerSquadId.isBlank()) throw IllegalArgumentException("buyerSquadId is required")
        transaction {
            val listing = loadTradeForUpdate(tradeId) ?: throw IllegalArgumentException("Trade not found")
            if (listing.status != TradeStatus.PENDING) throw IllegalStateException("Listing is not PENDING")
            if (!isOpenSellListing(listing)) throw IllegalArgumentException("Trade is not an open sell listing")
            if (listing.fromSquadId == buyerSquadId) throw IllegalArgumentException("Seller squad cannot accept its own listing")

            val auction = auctionRepository.findById(listing.auctionId)
                ?: throw AuctionNotFoundException("Auction not found")
            ensureAuctionCompleted(auction)
            ensureSquadsInAuction(listing.auctionId, listing.fromSquadId, buyerSquadId)
            ensureOwnership(listing.fromSquadId, listing.fromPlayerIds)

            val resolved = listing.copy(toSquadId = buyerSquadId)
            applyWalletLegs(resolved)
            applyPlayerTransfers(resolved)

            val now = Instant.now().toEpochMilli()
            Trades.update({ Trades.id eq tradeId }) {
                it[toSquadId] = buyerSquadId
                it[status] = TradeStatus.ACCEPTED
                it[updatedAt] = now
            }
        }
        return getById(tradeId)!!
    }

    fun rejectTrade(tradeId: String): TradeResponse = markTrade(tradeId, TradeStatus.REJECTED)
    fun cancelTrade(tradeId: String): TradeResponse = markTrade(tradeId, TradeStatus.CANCELLED)

    fun listByAuction(auctionId: String): List<TradeResponse> =
        transaction {
            Trades.selectAll()
                .where { Trades.auctionId eq auctionId }
                .orderBy(Trades.createdAt to SortOrder.DESC)
                .map { it.toTradeResponse() }
        }

    fun getById(tradeId: String): TradeResponse? =
        transaction {
            Trades.selectAll()
                .where { Trades.id eq tradeId }
                .firstOrNull()
                ?.toTradeResponse()
        }

    private fun markTrade(tradeId: String, status: TradeStatus): TradeResponse {
        transaction {
            val current = loadTradeForUpdate(tradeId) ?: throw IllegalArgumentException("Trade not found")
            if (current.status != TradeStatus.PENDING) throw IllegalStateException("Trade is not PENDING")
            Trades.update({ Trades.id eq tradeId }) {
                it[Trades.status] = status
                it[updatedAt] = Instant.now().toEpochMilli()
            }
        }
        return getById(tradeId)!!
    }

    private fun applyWalletLegs(t: TradeResponse) {
        val fromParticipant = squadParticipantId(t.fromSquadId)
        val toParticipant = squadParticipantId(t.toSquadId)

        if (t.cashFromToTo > BigDecimal.ZERO) {
            val fromWallet = walletRepository.findForUpdate(fromParticipant, t.auctionId)
                ?: throw IllegalStateException("Wallet not found for from-squad participant")
            if (fromWallet.balance < t.cashFromToTo) throw IllegalStateException("Insufficient wallet for from-squad")
            walletRepository.decrementBalance(fromParticipant, t.auctionId, t.cashFromToTo)
            walletRepository.incrementBalance(toParticipant, t.auctionId, t.cashFromToTo)
        }
        if (t.cashToToFrom > BigDecimal.ZERO) {
            val toWallet = walletRepository.findForUpdate(toParticipant, t.auctionId)
                ?: throw IllegalStateException("Wallet not found for to-squad participant")
            if (toWallet.balance < t.cashToToFrom) throw IllegalStateException("Insufficient wallet for to-squad")
            walletRepository.decrementBalance(toParticipant, t.auctionId, t.cashToToFrom)
            walletRepository.incrementBalance(fromParticipant, t.auctionId, t.cashToToFrom)
        }
    }

    private fun applyPlayerTransfers(t: TradeResponse) {
        val tradeTimestamp = Instant.now().toEpochMilli()
        // Keep the same purchase price row value when moving ownership.
        t.fromPlayerIds.forEach { playerId ->
            val price = squadPlayerPrice(t.fromSquadId, playerId) ?: BigDecimal.ZERO
            SquadPlayers.deleteWhere { (SquadPlayers.squadId eq t.fromSquadId) and (SquadPlayers.playerId eq playerId) }
            SquadPlayers.insert {
                it[id] = UUID.randomUUID().toString()
                it[squadId] = t.toSquadId
                it[SquadPlayers.playerId] = playerId
                it[purchasePrice] = price
                it[SquadPlayers.joinedAt] = tradeTimestamp
            }
        }
        t.toPlayerIds.forEach { playerId ->
            val price = squadPlayerPrice(t.toSquadId, playerId) ?: BigDecimal.ZERO
            SquadPlayers.deleteWhere { (SquadPlayers.squadId eq t.toSquadId) and (SquadPlayers.playerId eq playerId) }
            SquadPlayers.insert {
                it[id] = UUID.randomUUID().toString()
                it[squadId] = t.fromSquadId
                it[SquadPlayers.playerId] = playerId
                it[purchasePrice] = price
                it[SquadPlayers.joinedAt] = tradeTimestamp
            }
        }
    }

    private fun squadPlayerPrice(squadId: String, playerId: String): BigDecimal? =
        SquadPlayers.selectAll()
            .where { (SquadPlayers.squadId eq squadId) and (SquadPlayers.playerId eq playerId) }
            .forUpdate()
            .firstOrNull()
            ?.get(SquadPlayers.purchasePrice)

    private fun squadParticipantId(squadId: String): UUID =
        Squads.select(Squads.participantId)
            .where { Squads.id eq squadId }
            .firstOrNull()
            ?.get(Squads.participantId)
            ?: throw IllegalStateException("Squad participant not found")

    private fun ensureSquadsInAuction(auctionId: String, fromSquadId: String, toSquadId: String) {
        if (fromSquadId == toSquadId) throw IllegalArgumentException("fromSquadId and toSquadId cannot be same")
        val okFrom = Squads.selectAll().where { (Squads.id eq fromSquadId) and (Squads.auctionId eq auctionId) }.count() > 0
        val okTo = Squads.selectAll().where { (Squads.id eq toSquadId) and (Squads.auctionId eq auctionId) }.count() > 0
        if (!okFrom || !okTo) throw IllegalArgumentException("Both squads must belong to the auction")
    }

    private fun ensureSquadInAuction(auctionId: String, squadId: String) {
        val ok = Squads.selectAll().where { (Squads.id eq squadId) and (Squads.auctionId eq auctionId) }.count() > 0
        if (!ok) throw IllegalArgumentException("Squad must belong to the auction")
    }

    private fun ensureOwnership(squadId: String, playerIds: List<String>) {
        if (playerIds.isEmpty()) return
        val owned = SquadPlayers.selectAll()
            .where { (SquadPlayers.squadId eq squadId) and (SquadPlayers.playerId inList playerIds) }
            .map { it[SquadPlayers.playerId] }
            .toSet()
        if (owned.size != playerIds.toSet().size) {
            throw IllegalArgumentException("One or more traded players are not owned by squad=$squadId")
        }
    }

    private fun ensurePlayersAreUnsold(playerIds: List<String>) {
        if (playerIds.isEmpty()) return
        val soldCount = SquadPlayers.selectAll()
            .where { SquadPlayers.playerId inList playerIds }
            .count()
        if (soldCount > 0) {
            throw IllegalArgumentException("One or more players are already owned by a squad and cannot be picked from the unsold pool")
        }
    }

    private fun applyPlayerTransfersUnsoldPool(t: TradeResponse) {
        val tradeTimestamp = Instant.now().toEpochMilli()
        // fromPlayerIds: release from squad back to the unsold pool
        t.fromPlayerIds.forEach { playerId ->
            SquadPlayers.deleteWhere { (SquadPlayers.squadId eq t.fromSquadId) and (SquadPlayers.playerId eq playerId) }
            Players.update({ Players.id eq playerId }) {
                it[Players.isSold] = false
                it[Players.updatedAt] = tradeTimestamp
            }
        }
        // toPlayerIds: unsold pool players being signed to fromSquad
        t.toPlayerIds.forEach { playerId ->
            val basePrice = Players.selectAll()
                .where { Players.id eq playerId }
                .firstOrNull()?.get(Players.basePrice) ?: BigDecimal.ZERO
            SquadPlayers.insert {
                it[id] = UUID.randomUUID().toString()
                it[squadId] = t.fromSquadId
                it[SquadPlayers.playerId] = playerId
                it[purchasePrice] = basePrice
                it[SquadPlayers.joinedAt] = tradeTimestamp
            }
            Players.update({ Players.id eq playerId }) {
                it[Players.isSold] = true
                it[Players.updatedAt] = tradeTimestamp
            }
        }
    }

    private fun validateTradeRequest(r: CreateTradeRequest) {
        if (r.fromPlayerIds.isEmpty() && r.toPlayerIds.isEmpty()) {
            throw IllegalArgumentException("Trade must include at least one player on either side")
        }
        if (r.cashFromToTo < BigDecimal.ZERO || r.cashToToFrom < BigDecimal.ZERO) {
            throw IllegalArgumentException("Cash legs cannot be negative")
        }
        if (r.fromPlayerIds.any { it.isBlank() } || r.toPlayerIds.any { it.isBlank() }) {
            throw IllegalArgumentException("Player IDs cannot be blank")
        }
        if (r.toSquadId == UNSOLD_POOL && r.toPlayerIds.isEmpty() && r.fromPlayerIds.isEmpty()) {
            throw IllegalArgumentException("Unsold pool trade must involve at least one player")
        }
    }

    private fun ensureAuctionCompleted(auction: Auction) {
        if (auction.status != AuctionStatus.COMPLETED) {
            throw InvalidAuctionStateException("Trades are allowed only after auction completion")
        }
    }

    private fun loadTradeForUpdate(id: String): TradeResponse? =
        Trades.selectAll()
            .where { Trades.id eq id }
            .forUpdate()
            .firstOrNull()
            ?.toTradeResponse()

    private fun ResultRow.toTradeResponse(): TradeResponse {
        val fromCsv = this[Trades.fromPlayerIdsCsv]
        val toCsv = this[Trades.toPlayerIdsCsv]
        val unsoldPool = this[Trades.isUnsoldPoolTrade]
        return TradeResponse(
            id = this[Trades.id],
            auctionId = this[Trades.auctionId],
            fromSquadId = this[Trades.fromSquadId],
            // Expose UNSOLD_POOL sentinel to clients instead of the placeholder squad ID.
            toSquadId = if (unsoldPool) UNSOLD_POOL else this[Trades.toSquadId],
            fromPlayerIds = fromCsv.split(",").map { it.trim() }.filter { it.isNotBlank() },
            toPlayerIds = toCsv.split(",").map { it.trim() }.filter { it.isNotBlank() },
            cashFromToTo = this[Trades.cashFromToTo],
            cashToToFrom = this[Trades.cashToToFrom],
            tradeType = this[Trades.tradeType],
            isUnsoldPoolTrade = unsoldPool,
            status = this[Trades.status],
            createdAt = this[Trades.createdAt],
            updatedAt = this[Trades.updatedAt]
        )
    }
}

