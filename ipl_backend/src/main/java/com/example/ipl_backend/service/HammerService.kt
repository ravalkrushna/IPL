package com.example.ipl_backend.service

import com.example.ipl_backend.exception.*
import com.example.ipl_backend.repository.*
import com.example.ipl_backend.model.*
import org.jetbrains.exposed.sql.transactions.transaction
import org.springframework.stereotype.Service
import java.math.BigDecimal
import java.util.UUID


@Service
class HammerService(
    private val bidRepository: BidRepository,
    private val walletRepository: WalletRepository,
    private val squadRepository: SquadRepository,
    private val playerRepository: PlayerRepository,
    private val auctionEngineService: AuctionEngineService,
    private val liveAuctionService: LiveAuctionService
) {

    fun hammerPlayer(playerId: String, auctionId: String): String {

        transaction {

            val highestBid = bidRepository.highestBidForUpdate(playerId, auctionId)

            // ✅ CORRECT UNSOLD LOGIC
            if (highestBid == null) {

                println("⚠ No bids → PLAYER UNSOLD")

                playerRepository.markAsUnsold(playerId)   // ✅ FIXED
                auctionEngineService.loadNextPlayer(auctionId)

                liveAuctionService.broadcastMessage(
                    playerId,
                    "PLAYER_UNSOLD"
                )

                return@transaction
            }

            val wallet = walletRepository.findForUpdate(highestBid.participantId)
                ?: throw RuntimeException("Wallet not found")

            if (wallet.balance < highestBid.amount)
                throw InsufficientBalanceException()

            val squad = squadRepository.findForUpdate(
                highestBid.participantId,
                auctionId
            ) ?: throw SquadNotFoundException()

            walletRepository.decrementBalance(
                highestBid.participantId,
                highestBid.amount
            )

            squadRepository.addPlayer(
                squad.id,
                playerId,
                highestBid.amount
            )

            playerRepository.markAsSold(playerId)
            auctionEngineService.loadNextPlayer(auctionId)

            liveAuctionService.broadcastPlayerSold(
                playerId,
                highestBid.participantId,
                highestBid.amount,
                squad.name
            )

            val updatedWallet =
                walletRepository.findForUpdate(highestBid.participantId)

            if (updatedWallet != null) {
                liveAuctionService.broadcastWalletUpdate(
                    highestBid.participantId,
                    updatedWallet.balance
                )
            }
        }

        return "Player hammered"
    }
}