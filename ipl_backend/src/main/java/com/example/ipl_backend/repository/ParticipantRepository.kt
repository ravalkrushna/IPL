package com.example.ipl_backend.repository

import com.example.ipl_backend.model.Participant
import com.example.ipl_backend.model.Participants
import com.example.ipl_backend.model.Users
import org.jetbrains.exposed.dao.id.EntityID
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction
import org.springframework.stereotype.Repository
import java.time.Instant
import java.util.UUID

@Repository
class ParticipantRepository {

    private fun ResultRow.toParticipant(): Participant =
        Participant(
            id        = this[Participants.id].value,
            userId    = this[Participants.userId]?.value,   // safe null unwrap
            name      = this[Participants.name],
            createdAt = this[Participants.createdAt],
            updatedAt = this[Participants.updatedAt]
        )

    fun save(participant: Participant) {
        transaction {
            Participants.insert {
                it[id]        = participant.id
                it[userId]    = participant.userId?.let { uid -> EntityID(uid, Users) }  // null-safe
                it[name]      = participant.name
                it[createdAt] = participant.createdAt
                it[updatedAt] = participant.updatedAt
            }
        }
    }

    fun findByUserId(userId: UUID): Participant? =
        transaction {
            Participants.selectAll()
                .where { Participants.userId eq EntityID(userId, Users) }
                .limit(1)
                .map { it.toParticipant() }
                .singleOrNull()
        }

    fun findAll(): List<Participant> =
        transaction {
            Participants.selectAll()
                .orderBy(Participants.createdAt to SortOrder.ASC)
                .map { it.toParticipant() }
        }

    fun findAllIds(): List<UUID> =
        transaction {
            Participants.select(Participants.id)
                .map { it[Participants.id].value }
        }

    fun findById(id: UUID): Participant? =
        transaction {
            Participants.selectAll()
                .where { Participants.id eq EntityID(id, Participants) }
                .limit(1)
                .map { it.toParticipant() }
                .singleOrNull()
        }

    fun existsByName(name: String): Boolean =
        transaction {
            Participants
                .select(Participants.id)
                .where { Participants.name.lowerCase() eq name.lowercase() }
                .limit(1)
                .count() > 0
        }

    fun update(id: UUID, name: String) {
        transaction {
            Participants.update({ Participants.id eq EntityID(id, Participants) }) {
                it[Participants.name]      = name
                it[Participants.updatedAt] = Instant.now().toEpochMilli()
            }
        }
    }

    fun delete(id: UUID) {
        transaction {
            Participants.deleteWhere { Participants.id eq EntityID(id, Participants) }
        }
    }
}