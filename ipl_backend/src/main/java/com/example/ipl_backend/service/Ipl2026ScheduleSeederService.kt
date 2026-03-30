package com.example.ipl_backend.service

import com.example.ipl_backend.model.IplMatch
import com.example.ipl_backend.model.UpcomingMatch
import com.example.ipl_backend.repository.IplMatchRepository
import com.example.ipl_backend.repository.UpcomingMatchRepository
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import java.time.Instant

@Service
class Ipl2026ScheduleSeederService(
    private val upcomingMatchRepository: UpcomingMatchRepository,
    private val iplMatchRepository: IplMatchRepository,
    private val sheetsSyncService: GoogleSheetsSyncService,
    private val iplScraperService: IplScraperService
) {

    private val log = LoggerFactory.getLogger(javaClass)

    companion object {
        const val SEASON = "2026"
    }

    data class ParsedMatch(
        val matchNo: Int,
        val teamA: String,
        val teamB: String,
        val matchDate: Long,
        val cricinfoUrl: String?
    )

    data class SeedResult(
        val inserted: Int,
        val skipped: Int,
        val message: String
    )

    fun seedSchedule(): SeedResult {
        log.info("Loading IPL 2026 schedule from official IPL JSON feed…")
        val matches = fetchMatches()
        if (matches.isEmpty()) {
            log.warn("No matches returned from official feed — nothing seeded")
            return SeedResult(
                0,
                0,
                "Official IPL schedule feed returned no matches — check ipl.feed.competition-id, ipl.feed.base-url, and network"
            )
        }
        return persistMatches(matches)
    }

    fun reseedSchedule(): SeedResult {
        log.info("Reseeding — clearing existing 2026 upcoming fixtures…")
        val deleted = upcomingMatchRepository.deleteBySeason(SEASON)
        iplMatchRepository.deleteUnscrapedBySeason(SEASON)
        log.info("Deleted $deleted existing record(s)")
        val matches = fetchMatches()
        if (matches.isEmpty()) {
            log.warn("No matches returned from official feed — nothing reseeded")
            return SeedResult(
                0,
                0,
                "Official IPL schedule feed returned no matches — check ipl.feed.competition-id, ipl.feed.base-url, and network"
            )
        }
        return persistMatches(matches)
    }

    private fun fetchMatches(): List<ParsedMatch> {
        return try {
            val rows = iplScraperService.loadFixtureRowsFromOfficialFeed()
            if (rows.isEmpty()) {
                log.warn("Official feed returned no schedule rows")
                emptyList()
            } else {
                log.info("Loaded ${rows.size} fixtures from official feed")
                rows.map { r ->
                    ParsedMatch(
                        matchNo = r.matchNo,
                        teamA = r.teamA,
                        teamB = r.teamB,
                        matchDate = r.matchDateEpochMs,
                        cricinfoUrl = null
                    )
                }
            }
        } catch (e: Exception) {
            log.error("Failed to load schedule from official feed: ${e.message}", e)
            emptyList()
        }
    }

    private fun persistMatches(matches: List<ParsedMatch>): SeedResult {
        var inserted = 0
        var skipped = 0

        for (m in matches) {
            val id = "ipl-2026-m${m.matchNo}"

            val upcomingRecord = UpcomingMatch(
                id = id,
                matchNo = m.matchNo,
                teamA = m.teamA,
                teamB = m.teamB,
                matchDate = m.matchDate,
                season = SEASON,
                createdAt = Instant.now().toEpochMilli()
            )
            val wasInserted = upcomingMatchRepository.saveIfAbsent(upcomingRecord)

            val iplRecord = IplMatch(
                id = id,
                matchNo = m.matchNo,
                teamA = m.teamA,
                teamB = m.teamB,
                matchDate = m.matchDate,
                cricinfoUrl = m.cricinfoUrl,
                isScraped = false,
                season = SEASON,
                createdAt = Instant.now().toEpochMilli()
            )
            iplMatchRepository.findOrCreate(iplRecord)

            if (wasInserted) {
                log.info("  ✅ Inserted Match ${m.matchNo}: ${m.teamA} vs ${m.teamB}")
                inserted++
            } else {
                log.debug("  ⏭️  Match ${m.matchNo} already exists — skipped")
                skipped++
            }
        }

        try {
            sheetsSyncService.syncFixturesToSheet()
            log.info("Fixtures sheet updated after seeding")
        } catch (e: Exception) {
            log.error("Sheet sync after seed failed: ${e.message}", e)
        }

        val msg = "IPL 2026 — $inserted inserted, $skipped skipped"
        log.info(msg)
        return SeedResult(inserted, skipped, msg)
    }
}
