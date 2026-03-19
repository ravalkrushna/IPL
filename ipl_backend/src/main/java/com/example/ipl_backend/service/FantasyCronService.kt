package com.example.ipl_backend.service

import com.example.ipl_backend.model.IplMatch
import com.example.ipl_backend.model.PlayerMatchPerformance
import com.example.ipl_backend.repository.IplMatchRepository
import com.example.ipl_backend.repository.PlayerFantasyTotalsRepository
import com.example.ipl_backend.repository.PlayerMatchPerformanceRepository
import com.example.ipl_backend.repository.PlayerRepository
import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service
import java.math.BigDecimal
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneOffset
import java.util.UUID

@Service
class FantasyCronService(
    private val scraper: IplScraperService,
    private val calculator: FantasyPointsCalculator,
    private val playerRepository: PlayerRepository,
    private val performanceRepository: PlayerMatchPerformanceRepository,
    private val fantasyTotalsRepository: PlayerFantasyTotalsRepository,
    private val matchRepository: IplMatchRepository,
    private val sheetsSyncService: GoogleSheetsSyncService
) {

    private val log = LoggerFactory.getLogger(javaClass)

    // ── Cron: runs every day at 12:00 PM ─────────────────────────────────────
    // Scrapes yesterday's completed IPL 2026 match via CricAPI, calculates
    // fantasy points, persists them, then updates both Google Sheets tabs.

    @Scheduled(cron = "0 30 6 * * *")
    fun syncMatchResults() {
        log.info("=== Fantasy cron job started ===")

        val scrapedMatch = scraper.scrapeLatestMatch()
        if (scrapedMatch == null) {
            log.warn("No match scraped — skipping sync")
            return
        }

        log.info("Processing: ${scrapedMatch.matchLabel} — ${scrapedMatch.players.size} players")

        // Resolve (or create) the canonical IplMatch row for this match.
        // This guarantees the FK in player_match_performances is satisfied.
        val matchRecord = resolveMatchRecord(scrapedMatch)

        val now   = Instant.now().toEpochMilli()
        var saved = 0

        scrapedMatch.players.forEach { stats ->
            val player = playerRepository.findByName(stats.playerName)
                ?: playerRepository.findAll().firstOrNull {
                    normalizeName(it.name) == normalizeName(stats.playerName)
                }

            if (player == null) {
                log.warn("Player not found: ${stats.playerName}")
                return@forEach
            }

            // Idempotency: use the canonical match record ID, not the raw label
            if (performanceRepository.existsByPlayerIdAndMatchLabel(player.id, matchRecord.id)) {
                log.info("Already saved: ${stats.playerName} for ${matchRecord.id}")
                return@forEach
            }

            val perf = PlayerMatchPerformance(
                id              = UUID.randomUUID().toString(),
                playerId        = player.id,
                matchId         = matchRecord.id,   // FK-safe canonical ID
                runs            = stats.runs,
                ballsFaced      = stats.ballsFaced,
                fours           = stats.fours,
                sixes           = stats.sixes,
                dismissed       = stats.dismissed,
                wickets         = stats.wickets,
                lbwBowledCount  = stats.lbwBowledCount,
                oversBowled     = BigDecimal.valueOf(stats.oversBowled),
                runsGiven       = stats.runsGiven,
                maidens         = stats.maidens,
                catches         = stats.catches,
                stumpings       = stats.stumpings,
                runOutsDirect   = stats.runOutsDirect,
                runOutsIndirect = stats.runOutsIndirect,
                playingXi       = stats.playingXi,
                fantasyPoints   = 0,
                createdAt       = now
            )

            val points      = calculator.calculate(perf)
            val perfWithPts = perf.copy(fantasyPoints = points)

            performanceRepository.upsert(perfWithPts)
            fantasyTotalsRepository.addPoints(player.id, points)

            saved++
            log.info("${stats.playerName} → $points pts for ${matchRecord.id}")
        }

        log.info("Saved $saved performances for ${matchRecord.id}")
        matchRepository.markAsScraped(matchRecord.id)

        // ── Sync both sheets ──────────────────────────────────────────────────
        try {
            sheetsSyncService.syncToSheet()
            sheetsSyncService.syncAuctionTabs()
            log.info("Fantasy Points sheet updated")
        } catch (e: Exception) {
            log.error("Fantasy Points sheet sync failed: ${e.message}", e)
        }

        try {
            sheetsSyncService.syncFixturesToSheet()
            log.info("Fixtures sheet updated (match status → Completed)")
        } catch (e: Exception) {
            log.error("Fixtures sheet sync failed: ${e.message}", e)
        }

        log.info("=== Fantasy cron job completed ===")
    }

    // ── Manual trigger ────────────────────────────────────────────────────────
    fun triggerManually(): String {
        syncMatchResults()
        return "Sync triggered successfully"
    }

    // ── Match record resolution ───────────────────────────────────────────────
    // Looks up the pre-seeded IPL 2026 IplMatch row by matchNumber.
    // If the schedule hasn't been seeded yet, creates an on-the-fly record
    // so the FK constraint is always satisfied.

    private fun resolveMatchRecord(scraped: ScrapedMatch): IplMatch {
        val existing = matchRepository.findByMatchNoAndSeason(scraped.matchNumber, "2026")
        if (existing != null) return existing

        log.warn(
            "Match ${scraped.matchNumber} not found in DB — creating on-the-fly. " +
            "Run POST /admin/fantasy/seed-2026-schedule to pre-seed the full schedule."
        )

        val dateEpoch = runCatching {
            LocalDateTime.of(LocalDate.parse(scraped.date), LocalTime.of(14, 0))
                .toInstant(ZoneOffset.UTC).toEpochMilli()
        }.getOrDefault(Instant.now().toEpochMilli())

        val newMatch = IplMatch(
            id          = "ipl-2026-m${scraped.matchNumber}",
            matchNo     = scraped.matchNumber,
            teamA       = scraped.team1,
            teamB       = scraped.team2,
            matchDate   = dateEpoch,
            cricinfoUrl = null,
            isScraped   = false,
            season      = "2026",
            createdAt   = Instant.now().toEpochMilli()
        )

        return matchRepository.findOrCreate(newMatch)
    }

    private fun normalizeName(name: String) = name
        .lowercase()
        .replace(Regex("^[a-z]\\.\\s*"), "")
        .replace(Regex("[^a-z ]"), "")
        .replace(Regex("\\s+"), " ")
        .trim()
}
