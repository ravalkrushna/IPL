package com.example.ipl_backend.service

import com.example.ipl_backend.exception.AuctionNotFoundException
import com.example.ipl_backend.exception.InvalidAuctionStateException
import com.example.ipl_backend.model.*
import com.example.ipl_backend.repository.*
import org.springframework.stereotype.Service
import java.math.BigDecimal

@Service
class MidSeasonService(
    private val auctionRepository: AuctionRepository,
    private val squadRepository: SquadRepository,
    private val playerRepository: PlayerRepository,
    private val midSeasonRepository: MidSeasonRepository,
    private val walletRepository: WalletRepository,
    private val bidRepository: BidRepository,
    private val auctionPoolRepository: AuctionPoolRepository,
    private val auctionEngineService: AuctionEngineService,
    private val performanceRepository: PlayerMatchPerformanceRepository,
    private val iplMatchRepository: IplMatchRepository,
    private val fantasyPointsCalculator: FantasyPointsCalculator
) {

    // ── Phase 1: Begin retention entry ────────────────────────────────────────

    fun startRetentionPhase(auctionId: String): Auction {
        val auction = auctionRepository.findById(auctionId)
            ?: throw AuctionNotFoundException("Auction not found: $auctionId")
        if (auction.status != AuctionStatus.COMPLETED) {
            throw InvalidAuctionStateException("Mid-season auction can only start after the main auction is COMPLETED")
        }
        if (auction.midSeasonPhase != MidSeasonPhase.NOT_STARTED) {
            throw InvalidAuctionStateException("Mid-season auction already started (phase: ${auction.midSeasonPhase})")
        }

        val now = System.currentTimeMillis()

        // Lock each squad's current fantasy points at this exact moment so that
        // matches played during the retention-entry window don't shift the snapshot.
        val squads = squadRepository.findByAuction(auctionId)
        val seasonMatches = iplMatchRepository.findBySeason("2026")
        val seasonMatchIds = seasonMatches.map { it.id }.toSet()
        val matchDateById = seasonMatches.associate { it.id to it.matchDate }
        val allPlayerIds = squads.flatMap { squadRepository.getPlayers(it.id).map { p -> p.id } }
        val allPerformancesByPlayer = if (allPlayerIds.isNotEmpty()) {
            performanceRepository.findByPlayerIds(allPlayerIds)
                .filter { it.matchId in seasonMatchIds }
                .groupBy { it.playerId }
        } else emptyMap()

        squads.forEach { squad ->
            val playerDetails = squadRepository.getSquadPlayersBySquadId(squad.id)
            var squadTotal = 0
            playerDetails.forEach { detail ->
                val pts = allPerformancesByPlayer[detail.id].orEmpty()
                    .filter { (matchDateById[it.matchId] ?: 0L) >= detail.joinedAt }
                    .sumOf { fantasyPointsCalculator.calculate(it) }
                squadTotal += pts
                val player = playerRepository.findById(detail.id)
                midSeasonRepository.saveSnapshotPlayer(
                    auctionId   = auctionId,
                    squadId     = squad.id,
                    playerId    = detail.id,
                    playerName  = detail.name,
                    specialism  = detail.specialism,
                    iplTeam     = player?.iplTeam,
                    soldPrice   = detail.soldPrice,
                    points      = pts,
                    joinedAt    = detail.joinedAt
                )
            }
            midSeasonRepository.saveSnapshot(auctionId, squad.id, squadTotal, now)
        }

        auctionRepository.updateMidSeasonPhase(auctionId, MidSeasonPhase.RETENTION_ENTRY, now)
        return auctionRepository.findById(auctionId)!!
    }

    // ── Retention management ─────────────────────────────────────────────────

    fun addRetention(auctionId: String, squadId: String, playerId: String): MidSeasonRetention {
        val auction = auctionRepository.findById(auctionId)
            ?: throw AuctionNotFoundException("Auction not found: $auctionId")
        if (auction.midSeasonPhase != MidSeasonPhase.RETENTION_ENTRY) {
            throw InvalidAuctionStateException("Retentions can only be added during RETENTION_ENTRY phase")
        }

        val count = midSeasonRepository.countRetentionsForSquad(auctionId, squadId)
        if (count >= 4) {
            throw InvalidAuctionStateException("Squad already has 4 retentions (maximum allowed)")
        }
        if (midSeasonRepository.playerAlreadyRetained(auctionId, squadId, playerId)) {
            throw InvalidAuctionStateException("Player is already retained for this squad")
        }

        // Verify player is actually in this squad
        val squadPlayers = squadRepository.getPlayers(squadId)
        if (squadPlayers.none { it.id == playerId }) {
            throw InvalidAuctionStateException("Player does not belong to this squad")
        }

        return midSeasonRepository.addRetention(auctionId, squadId, playerId)
    }

    fun removeRetention(auctionId: String, squadId: String, playerId: String) {
        val auction = auctionRepository.findById(auctionId)
            ?: throw AuctionNotFoundException("Auction not found: $auctionId")
        if (auction.midSeasonPhase != MidSeasonPhase.RETENTION_ENTRY) {
            throw InvalidAuctionStateException("Retentions can only be modified during RETENTION_ENTRY phase")
        }
        midSeasonRepository.removeRetention(auctionId, squadId, playerId)
    }

    fun getRetentions(auctionId: String): List<MidSeasonRetention> =
        midSeasonRepository.findRetentionsByAuction(auctionId)

    fun getSquadRetentions(auctionId: String, squadId: String): List<MidSeasonRetention> =
        midSeasonRepository.findRetentionsBySquad(auctionId, squadId)

    // ── Phase 2: Finalize and launch re-auction ───────────────────────────────

    fun finalizeMidSeason(auctionId: String): Auction {
        val auction = auctionRepository.findById(auctionId)
            ?: throw AuctionNotFoundException("Auction not found: $auctionId")
        if (auction.midSeasonPhase != MidSeasonPhase.RETENTION_ENTRY) {
            throw InvalidAuctionStateException("Can only finalize during RETENTION_ENTRY phase")
        }

        val now = System.currentTimeMillis()
        val squads = squadRepository.findByAuction(auctionId)
        val allRetentions = midSeasonRepository.findRetentionsByAuction(auctionId)
        val retentionsBySquad = allRetentions.groupBy { it.squadId }

        // Process each squad
        squads.forEach { squad ->
            val retainedPlayerIds = (retentionsBySquad[squad.id] ?: emptyList())
                .map { it.playerId }.toSet()

            // Remove non-retained players and reset their auction flags
            val released = squadRepository.removeNonRetainedPlayers(squad.id, retainedPlayerIds)
            if (released.isNotEmpty()) {
                playerRepository.resetPlayersByIds(released)
                bidRepository.deleteForPlayersInAuction(released, auctionId)
            }

            // Update retained players: mark isRetained=true, update joinedAt to now
            retainedPlayerIds.forEach { playerId ->
                squadRepository.updateRetainedPlayer(squad.id, playerId, now)
            }
        }

        // Reset all wallets to 100 CR then deduct retention costs
        walletRepository.resetAllWalletsToStartingBalance(auctionId)
        squads.forEach { squad ->
            val retentions = retentionsBySquad[squad.id] ?: emptyList()
            val totalCost = retentions.fold(BigDecimal.ZERO) { acc, r -> acc + r.retentionCost }
            if (totalCost > BigDecimal.ZERO) {
                walletRepository.decrementBalance(squad.participantId, auctionId, totalCost)
            }
        }

        // Reset the ALL pool so admin can activate it again
        val allPool = auctionPoolRepository.findByAuctionAndType(auctionId, PoolType.ALL)
        if (allPool != null && allPool.status == PoolStatus.COMPLETED) {
            auctionPoolRepository.updateStatus(allPool.id, PoolStatus.PENDING)
        }

        // Reset engine state so a fresh queue is built for the re-auction
        auctionEngineService.resetForNewAuction(auctionId)

        // Mark reauction started and set mid-season phase to LIVE
        auctionRepository.markReauctionStarted(auctionId, now)
        auctionRepository.updateMidSeasonPhase(auctionId, MidSeasonPhase.LIVE, now)
        auctionRepository.updateStatus(auctionId, AuctionStatus.LIVE)

        return auctionRepository.findById(auctionId)!!
    }

    // ── Status & summary ──────────────────────────────────────────────────────

    fun getStatus(auctionId: String): MidSeasonStatusResponse {
        val auction = auctionRepository.findById(auctionId)
            ?: throw AuctionNotFoundException("Auction not found: $auctionId")
        val squads = squadRepository.findByAuction(auctionId)
        val retentions = midSeasonRepository.findRetentionsByAuction(auctionId)
        val snapshots = midSeasonRepository.findAllSnapshots(auctionId)
        val snapshotBySquad = snapshots.associateBy { it.squadId }
        val retentionsBySquad = retentions.groupBy { it.squadId }

        val squadSummaries = squads.map { squad ->
            val squadRetentions = retentionsBySquad[squad.id] ?: emptyList()
            val totalCost = squadRetentions.fold(BigDecimal.ZERO) { acc, r -> acc + r.retentionCost }
            val snapshot = snapshotBySquad[squad.id]
            SquadRetentionSummary(
                squadId       = squad.id,
                squadName     = squad.name,
                retentions    = squadRetentions,
                totalCostCr   = totalCost,
                lockedPoints  = snapshot?.lockedPoints
            )
        }

        return MidSeasonStatusResponse(
            auctionId       = auctionId,
            midSeasonPhase  = auction.midSeasonPhase,
            pointsLockedAt  = auction.pointsLockedAt,
            squads          = squadSummaries
        )
    }
}

data class MidSeasonStatusResponse(
    val auctionId: String,
    val midSeasonPhase: MidSeasonPhase,
    val pointsLockedAt: Long?,
    val squads: List<SquadRetentionSummary>
)

data class SquadRetentionSummary(
    val squadId: String,
    val squadName: String,
    val retentions: List<MidSeasonRetention>,
    val totalCostCr: java.math.BigDecimal,
    val lockedPoints: Int?
)
