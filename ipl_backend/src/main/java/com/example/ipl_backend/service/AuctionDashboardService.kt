package com.example.ipl_backend.service

import com.example.ipl_backend.dto.*
import com.example.ipl_backend.repository.*
import org.springframework.stereotype.Service
import java.util.UUID

@Service
class AuctionDashboardService(
    private val playerRepository: PlayerRepository,
    private val walletRepository: WalletRepository,
    private val squadRepository: SquadRepository
) {

    fun soldPlayers() =
        playerRepository.findSoldPlayers()

    fun unsoldPlayers() =
        playerRepository.findUnsoldPlayers()

    // Leaderboard is now per-auction
    fun walletLeaderboard(auctionId: String) =
        walletRepository.leaderboard(auctionId)

    fun participantProfile(
        participantId: UUID,
        auctionId: String
    ): ParticipantProfileResponse {

        val wallet = walletRepository.findByParticipantAndAuction(participantId, auctionId)
            ?: throw RuntimeException("Wallet not found for participant in this auction")

        val squadPlayers = squadRepository.getSquadPlayers(participantId, auctionId)

        return ParticipantProfileResponse(
            participantId = participantId,
            walletBalance = wallet.balance,
            squad         = squadPlayers
        )
    }
}