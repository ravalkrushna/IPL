package com.example.ipl_backend.repository

import com.example.ipl_backend.model.UpcomingMatch
import com.example.ipl_backend.model.UpcomingMatches
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction
import org.springframework.stereotype.Repository

@Repository
class UpcomingMatchRepository {

    private fun ResultRow.toMatch() = UpcomingMatch(
        id        = this[UpcomingMatches.id],
        matchNo   = this[UpcomingMatches.matchNo],
        teamA     = this[UpcomingMatches.teamA],
        teamB     = this[UpcomingMatches.teamB],
        matchDate = this[UpcomingMatches.matchDate],
        season    = this[UpcomingMatches.season],
        createdAt = this[UpcomingMatches.createdAt]
    )

    fun findAll(): List<UpcomingMatch> = transaction {
        UpcomingMatches.selectAll()
            .orderBy(UpcomingMatches.matchDate to SortOrder.ASC)
            .map { it.toMatch() }
    }

    fun findBySeason(season: String): List<UpcomingMatch> = transaction {
        UpcomingMatches.selectAll()
            .where { UpcomingMatches.season eq season }
            .orderBy(UpcomingMatches.matchNo to SortOrder.ASC)
            .map { it.toMatch() }
    }

    fun existsById(id: String): Boolean = transaction {
        UpcomingMatches.selectAll()
            .where { UpcomingMatches.id eq id }
            .count() > 0
    }

    fun save(match: UpcomingMatch) = transaction {
        UpcomingMatches.insert {
            it[id]        = match.id
            it[matchNo]   = match.matchNo
            it[teamA]     = match.teamA
            it[teamB]     = match.teamB
            it[matchDate] = match.matchDate
            it[season]    = match.season
            it[createdAt] = match.createdAt
        }
    }

    // Idempotent — skips if already exists
    fun saveIfAbsent(match: UpcomingMatch): Boolean {
        if (existsById(match.id)) return false
        save(match)
        return true
    }

    fun deleteAll(): Int = transaction {
        UpcomingMatches.deleteAll()
    }

    fun deleteBySeason(season: String): Int = transaction {
        UpcomingMatches.deleteWhere { UpcomingMatches.season eq season }
    }
}