package com.example.ipl_backend.config

import com.example.ipl_backend.model.Auctions
import com.example.ipl_backend.model.Bids
import com.example.ipl_backend.model.Otps
import com.example.ipl_backend.model.Participants
import com.example.ipl_backend.model.PlayerPurchases
import com.example.ipl_backend.model.Players
import com.example.ipl_backend.model.SquadPlayers
import com.example.ipl_backend.model.Squads
import com.example.ipl_backend.model.Users
import com.example.ipl_backend.model.Wallets
import jakarta.annotation.PostConstruct
import org.jetbrains.exposed.sql.SchemaUtils
import org.jetbrains.exposed.sql.transactions.transaction
import org.springframework.stereotype.Component

@Component
class SchemaInitializer {

    @PostConstruct
    fun init() {
        transaction {
            SchemaUtils.create(Players,
                PlayerPurchases,
                Wallets,
                Participants,
                Auctions,
                Squads,
                SquadPlayers,
                Bids,
                Users,
                Otps
            )
        }
    }
}