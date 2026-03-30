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

data class FantasySyncTriggerResult(
    val ok: Boolean,
    val message: String,
    val performancesSaved: Int = 0,
    val performancesUpdated: Int = 0,
    val playersSkippedNotInDb: Int = 0,
    val playersSkippedAlreadySaved: Int = 0,
    val matchId: String? = null,
    val matchLabel: String? = null,
    /** e.g. NO_MATCH_FROM_FEED, SCRAPER_ERROR */
    val reason: String? = null
)

data class FantasyRebuildAndSyncResult(
    val ok: Boolean,
    val message: String,
    val season: String,
    val performancesScanned: Int,
    val performancesUpdated: Int,
    val totalPointsBefore: Int,
    val totalPointsAfter: Int,
    val playersWithTotals: Int,
    val sheetSyncOk: Boolean
)

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
    // Scrapes yesterday's completed IPL 2026 match via IPLT20 feeds, calculates
    // fantasy points, persists them, then updates both Google Sheets tabs.

    @Scheduled(cron = "0 30 6 * * *")
    fun syncMatchResults() {
        log.info("=== Fantasy cron job started ===")
        val result = runSync(iplMatchId = null)
        log.info(
            "=== Fantasy cron job finished — ok={}, saved={}, notInDb={}, alreadySaved={}, msg={} ===",
            result.ok,
            result.performancesSaved,
            result.playersSkippedNotInDb,
            result.playersSkippedAlreadySaved,
            result.message
        )
    }

    /**
     * Manual trigger — returns details for Postman / debugging.
     * @param iplMatchId optional numeric IPL feed match id from GET /admin/fantasy/ipl-matches
     */
    fun triggerManually(iplMatchId: String? = null): FantasySyncTriggerResult {
        log.info("=== Manual fantasy sync triggered (matchId={}) ===", iplMatchId ?: "auto")
        return runSync(iplMatchId)
    }

    /**
     * Rebuilds fantasy points from DB score stats for the given season, resets player totals,
     * and syncs all relevant Google Sheet tabs in one go.
     */
    fun rebuildSeasonAndSyncAll(season: String = "2026"): FantasyRebuildAndSyncResult {
        log.info("=== Rebuild + sync started for season={} ===", season)

        val perfs = performanceRepository.findAllPerformancesForSeason(season)
        val before = perfs.sumOf { it.fantasyPoints }
        var updated = 0

        perfs.forEach { perf ->
            val recalculated = calculator.calculate(perf)
            if (recalculated != perf.fantasyPoints) updated++
            performanceRepository.upsert(perf.copy(fantasyPoints = recalculated))
        }

        // Rebuild totals from scratch so leaderboard APIs and sheets stay consistent.
        fantasyTotalsRepository.deleteAll()
        val refreshed = performanceRepository.findAllPerformancesForSeason(season)
        refreshed.forEach { perf ->
            fantasyTotalsRepository.addPoints(perf.playerId, perf.fantasyPoints)
        }
        val after = refreshed.sumOf { it.fantasyPoints }
        val playersWithTotals = fantasyTotalsRepository.findAll().size

        var sheetOk = true
        try {
            sheetsSyncService.syncToSheet()
            sheetsSyncService.syncAuctionTabs()
            sheetsSyncService.syncFixturesToSheet()
        } catch (e: Exception) {
            sheetOk = false
            log.error("Rebuild completed but sheet sync failed: ${e.message}", e)
        }

        val msg = buildString {
            append("Rebuild complete for season $season: scanned ${perfs.size} performance row(s), ")
            append("updated $updated point row(s), rebuilt totals for $playersWithTotals player(s)")
            if (!sheetOk) append(", but sheet sync failed (check server logs)")
        }

        log.info("=== Rebuild + sync finished: {} ===", msg)
        return FantasyRebuildAndSyncResult(
            ok = sheetOk,
            message = msg,
            season = season,
            performancesScanned = perfs.size,
            performancesUpdated = updated,
            totalPointsBefore = before,
            totalPointsAfter = after,
            playersWithTotals = playersWithTotals,
            sheetSyncOk = sheetOk
        )
    }

    private fun runSync(iplMatchId: String? = null): FantasySyncTriggerResult {
        val scrapedMatch = try {
            if (!iplMatchId.isNullOrBlank()) {
                scraper.scrapeMatchByIplMatchId(iplMatchId.trim())
            } else {
                scraper.scrapeLatestMatch()
            }
        } catch (e: Exception) {
            log.error("Scraper failed: ${e.message}", e)
            return FantasySyncTriggerResult(
                ok = false,
                message = "IPL feed / scraper error: ${e.message}",
                reason  = "SCRAPER_ERROR"
            )
        }

        if (scrapedMatch == null) {
            log.warn("No match scraped — skipping sync")
            val hint = if (!iplMatchId.isNullOrBlank()) {
                "Scorecard failed for matchId=$iplMatchId (invalid id, match not finished, or no innings JSON). " +
                    "Try GET /admin/fantasy/ipl-matches for completed match ids."
            } else {
                "No completed IPL 2026 match in feed for yesterday/2d ago (IST), or last 14 days fallback. " +
                    "Call POST /admin/fantasy/sync-now?matchId=<id> using a numeric id from GET /admin/fantasy/ipl-matches."
            }
            return FantasySyncTriggerResult(
                ok = false,
                message = hint,
                reason = "NO_MATCH_FROM_FEED"
            )
        }

        log.info("Processing: ${scrapedMatch.matchLabel} — ${scrapedMatch.players.size} players")

        val matchRecord = resolveMatchRecord(scrapedMatch)
        val now         = Instant.now().toEpochMilli()
        var saved       = 0
        var updated     = 0
        var notInDb     = 0
        var alreadySaved = 0

        scrapedMatch.players.forEach { stats ->
            val player = playerRepository.findByName(stats.playerName)
                ?: playerRepository.findAll().firstOrNull {
                    normalizeName(it.name) == normalizeName(stats.playerName)
                }

            if (player == null) {
                log.warn("Player not found: ${stats.playerName}")
                notInDb++
                return@forEach
            }

            val alreadyExists = performanceRepository.existsByPlayerIdAndMatchLabel(player.id, matchRecord.id)
            if (alreadyExists) {
                // Refresh existing row as well (dot balls / corrected scorecard values can arrive later).
                alreadySaved++
            }

            val perf = PlayerMatchPerformance(
                id              = UUID.randomUUID().toString(),
                playerId        = player.id,
                matchId         = matchRecord.id,
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
                dotBalls        = stats.dotBalls,
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
            if (alreadyExists) {
                updated++
                log.info("Updated: ${stats.playerName} → $points pts for ${matchRecord.id}")
            } else {
                // Keep old behavior for fresh inserts; full consistency is still ensured by rebuild endpoint.
                fantasyTotalsRepository.addPoints(player.id, points)
                saved++
                log.info("Saved: ${stats.playerName} → $points pts for ${matchRecord.id}")
            }
        }

        log.info(
            "Processed ${matchRecord.id}: saved={}, updated={}, notInDb={}, alreadySaved={}",
            saved, updated, notInDb, alreadySaved
        )

        if (saved > 0 || alreadySaved > 0) {
            matchRepository.markAsScraped(matchRecord.id)
        }

        try {
            val sheetResult = sheetsSyncService.syncToSheet()
            sheetsSyncService.syncAuctionTabs()
            log.info(
                "Fantasy Points sheet — perfRows={}, matchCols={}, playerRows={}",
                sheetResult.performancesUsed,
                sheetResult.matchColumns,
                sheetResult.playerRowsWritten
            )
        } catch (e: Exception) {
            log.error("Fantasy Points sheet sync failed: ${e.message}", e)
        }

        try {
            sheetsSyncService.syncFixturesToSheet()
            log.info("Fixtures sheet updated")
        } catch (e: Exception) {
            log.error("Fixtures sheet sync failed: ${e.message}", e)
        }

        val summaryMsg = buildString {
            append("Match ${scrapedMatch.matchLabel}: saved $saved new performance row(s)")
            if (updated > 0) append(", updated $updated existing row(s)")
            if (alreadySaved > 0) append(", $alreadySaved already in DB")
            if (notInDb > 0) append(", $notInDb player name(s) not found in your players table")
        }

        return FantasySyncTriggerResult(
            ok = saved > 0 || alreadySaved > 0,
            message = summaryMsg,
            performancesSaved = saved,
            performancesUpdated = updated,
            playersSkippedNotInDb = notInDb,
            playersSkippedAlreadySaved = alreadySaved,
            matchId = matchRecord.id,
            matchLabel = scrapedMatch.matchLabel,
            reason = if (saved == 0 && alreadySaved == 0) "NO_ROWS_SAVED" else null
        )
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
        .replace(Regex("^[a-z]\\.?\\s*"), "") // drop leading initials like "N. " or "N "
        .replace(Regex("[^a-z ]"), "")       // keep only letters/spaces
        .replace(Regex("\\s+"), " ")
        .trim()
        // Common feed-vs-seed spelling mismatch (e.g. "N. Tilak Verma" vs "Tilak Varma")
        .replace("verma", "varma")
}
