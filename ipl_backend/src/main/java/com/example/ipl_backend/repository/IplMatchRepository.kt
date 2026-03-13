package com.example.ipl_backend.repository

import com.example.ipl_backend.model.IplMatch
import com.example.ipl_backend.model.IplMatches
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.inList
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.transactions.transaction
import org.springframework.stereotype.Repository
import java.time.Instant
import java.util.UUID

@Repository
class IplMatchRepository {

    private fun ResultRow.toMatch(): IplMatch =
        IplMatch(
            id          = this[IplMatches.id],
            matchNo     = this[IplMatches.matchNo],
            teamA       = this[IplMatches.teamA],
            teamB       = this[IplMatches.teamB],
            matchDate   = this[IplMatches.matchDate],
            cricinfoUrl = this[IplMatches.cricinfoUrl],
            isScraped   = this[IplMatches.isScraped],
            season      = this[IplMatches.season],
            createdAt   = this[IplMatches.createdAt]
        )

    fun save(match: IplMatch) {
        transaction {
            IplMatches.insert {
                it[id]          = match.id
                it[matchNo]     = match.matchNo
                it[teamA]       = match.teamA
                it[teamB]       = match.teamB
                it[matchDate]   = match.matchDate
                it[cricinfoUrl] = match.cricinfoUrl
                it[isScraped]   = match.isScraped
                it[season]      = match.season
                it[createdAt]   = match.createdAt
            }
        }
    }

    fun findAll(): List<IplMatch> =
        transaction {
            IplMatches.selectAll()
                .orderBy(IplMatches.matchDate to SortOrder.ASC)
                .map { it.toMatch() }
        }

    fun findById(id: String): IplMatch? =
        transaction {
            IplMatches.selectAll()
                .where { IplMatches.id eq id }
                .map { it.toMatch() }
                .singleOrNull()
        }

    // Find all matches on a given date that haven't been scraped yet
    fun findUnscrapedByDate(dateStartEpoch: Long, dateEndEpoch: Long): List<IplMatch> =
        transaction {
            IplMatches.selectAll()
                .where {
                    (IplMatches.matchDate greaterEq dateStartEpoch) and
                            (IplMatches.matchDate lessEq dateEndEpoch) and
                            (IplMatches.isScraped eq false)
                }
                .map { it.toMatch() }
        }

    // Find all unscraped matches — used by cron job
    fun findAllUnscraped(): List<IplMatch> =
        transaction {
            IplMatches.selectAll()
                .where { IplMatches.isScraped eq false }
                .orderBy(IplMatches.matchDate to SortOrder.ASC)
                .map { it.toMatch() }
        }

    fun markAsScraped(id: String) {
        transaction {
            IplMatches.update({ IplMatches.id eq id }) {
                it[isScraped] = true
            }
        }
    }

    fun delete(id: String) {
        transaction {
            IplMatches.deleteWhere { IplMatches.id eq id }
        }
    }

    fun findByTeamsAndDate(teamA: String, teamB: String, matchDate: Long): IplMatch? =
        transaction {
            IplMatches.selectAll()
                .where {
                    (IplMatches.matchDate eq matchDate) and
                        (
                            ((IplMatches.teamA eq teamA) and (IplMatches.teamB eq teamB)) or
                            ((IplMatches.teamA eq teamB) and (IplMatches.teamB eq teamA))
                        )
                }
                .map { it.toMatch() }
                .singleOrNull()
        }

    fun findBySeason(season: String): List<IplMatch> =
        transaction {
            IplMatches.selectAll()
                .where { IplMatches.season eq season }
                .orderBy(IplMatches.matchNo to SortOrder.ASC)
                .map { it.toMatch() }
        }

    fun findByMatchNoAndSeason(matchNo: Int, season: String): IplMatch? =
        transaction {
            IplMatches.selectAll()
                .where {
                    (IplMatches.matchNo eq matchNo) and
                    (IplMatches.season eq season)
                }
                .map { it.toMatch() }
                .singleOrNull()
        }

    // Deletes all unplayed (isScraped=false) fixtures for a given season.
    // Already-played matches (isScraped=true) are intentionally preserved.
    fun deleteUnscrapedBySeason(season: String): Int =
        transaction {
            IplMatches.deleteWhere {
                (IplMatches.season eq season) and (IplMatches.isScraped eq false)
            }
        }

    // Returns IDs of all 2025 matches (season='2025' or legacy null season).
    fun find2025MatchIds(): List<String> =
        transaction {
            IplMatches.selectAll()
                .where { (IplMatches.season eq "2025") or IplMatches.season.isNull() }
                .map { it[IplMatches.id] }
        }

    // Deletes matches by their IDs. Used after child FK rows have already been removed.
    fun deleteByIds(ids: List<String>): Int =
        transaction {
            if (ids.isEmpty()) return@transaction 0
            IplMatches.deleteWhere { IplMatches.id inList ids }
        }

    // Find if a record with this id exists; insert it if not. Returns the persisted record.
    fun findOrCreate(match: IplMatch): IplMatch {
        val existing = findById(match.id)
        if (existing != null) return existing
        save(match)
        return match
    }
}