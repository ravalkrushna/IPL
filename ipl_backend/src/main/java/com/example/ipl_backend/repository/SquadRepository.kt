package com.example.ipl_backend.repository

import com.example.ipl_backend.dto.SquadPlayerDetail
import com.example.ipl_backend.model.*
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import org.springframework.stereotype.Repository
import java.math.BigDecimal
import java.util.UUID

@Repository
class SquadRepository(
    private val playerRepository: PlayerRepository
) {

    private fun ResultRow.toSquad(): Squad =
        Squad(
            id = this[Squads.id],
            participantId = this[Squads.participantId],
            auctionId = this[Squads.auctionId],
            name = this[Squads.name],
            createdAt = this[Squads.createdAt]
        )

    fun save(squad: Squad) {
        transaction {
            Squads.insert {
                it[id] = squad.id
                it[participantId] = squad.participantId
                it[auctionId] = squad.auctionId
                it[name] = squad.name
                it[createdAt] = squad.createdAt
            }
        }
    }

    fun findByParticipantAndAuction(
        participantId: UUID,
        auctionId: String
    ): Squad? =
        transaction {
            Squads.selectAll()
                .where {
                    (Squads.participantId eq participantId) and
                            (Squads.auctionId eq auctionId)
                }
                .limit(1)
                .map { it.toSquad() }
                .singleOrNull()
        }

    fun findById(id: String): Squad? =
        transaction {
            Squads.selectAll()
                .where { Squads.id eq id }
                .limit(1)
                .map { it.toSquad() }
                .singleOrNull()
        }

    fun addPlayer(
        squadId: String,
        playerId: String,
        price: BigDecimal
    ) {
        transaction {
            // ✅ Guard: skip insert if this (squad, player) pair already exists.
            // This prevents the duplicate key crash when hammerPlayer is called
            // more than once for the same player (timer race + checkIfEveryonePassed).
            val alreadyExists = SquadPlayers
                .selectAll()
                .where {
                    (SquadPlayers.squadId eq squadId) and
                            (SquadPlayers.playerId eq playerId)
                }
                .count() > 0

            if (alreadyExists) {
                println("⚠️ addPlayer: ($squadId, $playerId) already in squad — skipping insert")
                return@transaction
            }

            SquadPlayers.insert {
                it[id] = UUID.randomUUID().toString()
                it[SquadPlayers.squadId] = squadId
                it[SquadPlayers.playerId] = playerId
                it[purchasePrice] = price
            }
        }
    }

    fun getPlayers(squadId: String): List<Player> =
        transaction {
            val playerIds = SquadPlayers
                .selectAll()
                .where { SquadPlayers.squadId eq squadId }
                .map { it[SquadPlayers.playerId] }

            playerRepository.findByIds(playerIds)
        }

    fun getSquadPlayers(
        participantId: UUID,
        auctionId: String
    ): List<SquadPlayerDetail> =
        transaction {
            val squad = Squads.selectAll()
                .where {
                    (Squads.participantId eq participantId) and
                            (Squads.auctionId eq auctionId)
                }
                .firstOrNull()
                ?: return@transaction emptyList()

            val squadId = squad[Squads.id]

            (SquadPlayers innerJoin Players)
                .selectAll()
                .where { SquadPlayers.squadId eq squadId }
                .map { row ->
                    SquadPlayerDetail(
                        id = row[Players.id],
                        name = row[Players.name],
                        country = row[Players.country],
                        age = row[Players.age],
                        specialism = row[Players.specialism],
                        battingStyle = row[Players.battingStyle],
                        bowlingStyle = row[Players.bowlingStyle],
                        testCaps = row[Players.testCaps],
                        odiCaps = row[Players.odiCaps],
                        t20Caps = row[Players.t20Caps],
                        basePrice = row[Players.basePrice],
                        soldPrice = row[SquadPlayers.purchasePrice]
                    )
                }
        }

    fun findForUpdate(
        participantId: UUID,
        auctionId: String
    ): Squad? =
        transaction {
            Squads.selectAll()
                .where {
                    (Squads.participantId eq participantId) and
                            (Squads.auctionId eq auctionId)
                }
                .forUpdate()
                .limit(1)
                .map { it.toSquad() }
                .singleOrNull()
        }

    fun countParticipantsInAuction(auctionId: String): Long = transaction {
        Squads
            .selectAll()
            .where { Squads.auctionId eq auctionId }
            .count()
    }
}