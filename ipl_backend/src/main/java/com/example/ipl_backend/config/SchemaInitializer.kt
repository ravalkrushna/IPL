package com.example.ipl_backend.config

import com.example.ipl_backend.model.*
import jakarta.annotation.PostConstruct
import org.jetbrains.exposed.sql.SchemaUtils
import org.jetbrains.exposed.sql.transactions.transaction
import org.springframework.stereotype.Component

@Component
class SchemaInitializer {

    @PostConstruct
    fun init() {
        transaction {
            SchemaUtils.createMissingTablesAndColumns(
                // ── Existing ──────────────────────────────────────────────
                Users,
                Participants,
                Auctions,
                Players,
                Wallets,
                Squads,
                SquadPlayers,
                Bids,
                Otps,
                AuctionPools,
                BidLogs,

                // ── Fantasy system (NEW) ───────────────────────────────────
                IplMatches,
                PlayerMatchPerformances,
                PlayerFantasyTotals,
                PlayerNameAliases,
                UpcomingMatches
            )
        }
    }
}