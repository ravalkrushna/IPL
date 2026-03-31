package com.example.ipl_backend.controller

import com.example.ipl_backend.repository.IplMatchRepository
import com.example.ipl_backend.repository.PlayerFantasyTotalsRepository
import com.example.ipl_backend.repository.PlayerMatchPerformanceRepository
import com.example.ipl_backend.repository.PlayerRepository
import com.example.ipl_backend.service.BasePriceSeederService
import com.example.ipl_backend.service.FantasyCronService
import com.example.ipl_backend.service.GoogleSheetsSyncService
import com.example.ipl_backend.service.Ipl2025SeederService
import com.example.ipl_backend.service.Ipl2026ScheduleSeederService
import com.example.ipl_backend.service.IplPlayerScraperService
import com.example.ipl_backend.service.IplScraperService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/admin/fantasy")
class FantasyAdminController(
    private val basePriceSeederService: BasePriceSeederService,
    private val ipl2025SeederService: Ipl2025SeederService,
    private val scraperService: IplPlayerScraperService,
    private val playerRepository: PlayerRepository,
    private val ipl2026ScheduleSeeder: Ipl2026ScheduleSeederService,
    private val fantasyCronService: FantasyCronService,
    private val sheetsSyncService: GoogleSheetsSyncService,
    private val iplScraperService: IplScraperService,
    private val iplMatchRepository: IplMatchRepository,
    private val performanceRepository: PlayerMatchPerformanceRepository,
    private val fantasyTotalsRepository: PlayerFantasyTotalsRepository
) {

    // ── IPL 2025 career data ──────────────────────────────────────────────────

    /**
     * Downloads IPL 2025 ball-by-ball data from cricsheet.org and seeds
     * ipl_matches + player_match_performances + player_fantasy_totals.
     * Idempotent — skips matches already present in the DB.
     */
    @PostMapping("/seed-2025")
    fun seedIpl2025(): ResponseEntity<Any> {
        val result = ipl2025SeederService.seedIpl2025()
        return if (result.success)
            ResponseEntity.ok(mapOf("message" to result.message))
        else
            ResponseEntity.internalServerError().body(mapOf("error" to result.message))
    }

    @PostMapping("/seed-base-prices")
    fun seedBasePrice(): ResponseEntity<Any> {
        val result = basePriceSeederService.seed()
        return ResponseEntity.ok(
            mapOf(
                "message" to "Base price seeding complete",
                "updated" to result.updated,
                "skipped" to result.skipped
            )
        )
    }

    // ── IPL 2025 data cleanup ─────────────────────────────────────────────────

    /**
     * Deletes all IPL 2025 match data in the correct FK order:
     *   1. player_match_performances for 2025 match IDs (removes FK child rows first)
     *   2. ipl_matches where season='2025' or season IS NULL (legacy)
     *   3. player_fantasy_totals (resets all totals so 2026 fantasy starts from zero)
     *
     * WARNING: After calling this, GET /api/v1/fantasy/player/{id}/ipl-career
     * will return zeros — 2025 career stats will no longer be available.
     */
    @PostMapping("/clear-2025-data")
    fun clearIpl2025Data(): ResponseEntity<Any> {
        val matchIds = iplMatchRepository.find2025MatchIds()
        val perfDeleted = performanceRepository.deleteByMatchIds(matchIds)
        val matchesDeleted = iplMatchRepository.deleteByIds(matchIds)
        val totalsDeleted = fantasyTotalsRepository.deleteAll()
        return ResponseEntity.ok(
            mapOf(
                "message"        to "IPL 2025 data cleared successfully",
                "matchIds"       to matchIds.size,
                "perfDeleted"    to perfDeleted,
                "matchesDeleted" to matchesDeleted,
                "totalsReset"    to totalsDeleted
            )
        )
    }

    // ── IPL 2026 fixtures ─────────────────────────────────────────────────────

    /**
     * Scrapes the available schedule from ESPNcricinfo, seeds new fixtures into
     * the DB (skips matches already present), and syncs the Google Sheet.
     * Safe to call multiple times — only inserts what is missing.
     */
    @PostMapping("/seed-2026-schedule")
    fun seedIpl2026Schedule(): ResponseEntity<Any> {
        val result = ipl2026ScheduleSeeder.seedSchedule()
        return ResponseEntity.ok(
            mapOf(
                "message"  to result.message,
                "inserted" to result.inserted,
                "skipped"  to result.skipped
            )
        )
    }

    /**
     * Clears all **unplayed** (isScraped=false) IPL 2026 fixtures from the DB,
     * re-scrapes the latest schedule from ESPNcricinfo, and syncs the Google Sheet.
     * Use this when new phases are published or dates/venues change.
     * Already-played matches (isScraped=true) are never touched.
     */
    @PostMapping("/reseed-2026-schedule")
    fun reseedIpl2026Schedule(): ResponseEntity<Any> {
        val result = ipl2026ScheduleSeeder.reseedSchedule()
        return ResponseEntity.ok(
            mapOf(
                "message"  to result.message,
                "inserted" to result.inserted,
                "skipped"  to result.skipped
            )
        )
    }

    /**
     * Re-syncs the "IPL 2026 Fixtures" sheet tab from whatever is currently in the DB.
     * Useful if the sheet is accidentally cleared or you want to refresh match statuses.
     */
    @PostMapping("/sync-fixtures")
    fun syncFixtures(): ResponseEntity<Any> {
        sheetsSyncService.syncFixturesToSheet()
        return ResponseEntity.ok(mapOf("message" to "Fixtures sheet synced successfully"))
    }

    // ── Fantasy points ────────────────────────────────────────────────────────

    /**
     * Lists completed IPL 2026 matches from official IPL JSON feeds (same data as iplt20.com results).
     * Use `matches[].id` with `POST .../sync-now?matchId=...` when auto-detect finds nothing.
     */
    @GetMapping("/ipl-matches")
    fun iplFeedMatches(): ResponseEntity<Any> {
        val diagnostics = iplScraperService.iplFeedDiagnostics()
        val rows = iplScraperService.listRecentIplMatchesForDebug(50)
        return ResponseEntity.ok(
            mapOf(
                "count" to rows.size,
                "matches" to rows,
                "diagnostics" to diagnostics,
                "hint" to "POST /admin/fantasy/sync-now?matchId=<numeric id> — writes DB + Google Sheets. Ids: diagnostics.sampleCompleted or matches[].id."
            )
        )
    }

    /** Same payload as [iplFeedMatches] — old path kept for existing clients. */
    @GetMapping("/cricapi-ipl-matches")
    fun legacyCricapiIplMatches(): ResponseEntity<Any> = iplFeedMatches()

    /**
     * Manually trigger the daily cron job: scrape yesterday's match,
     * calculate fantasy points, and update both Google Sheets tabs.
     * @param matchId optional numeric IPL feed match id (from GET /admin/fantasy/ipl-matches)
     */
    @PostMapping("/sync-now")
    fun syncNow(@RequestParam(name = "matchId", required = false) matchId: String?): ResponseEntity<Any> {
        val r = fantasyCronService.triggerManually(matchId)
        return ResponseEntity.ok(
            mapOf(
                "ok"                         to r.ok,
                "message"                    to r.message,
                "performancesSaved"          to r.performancesSaved,
                "performancesUpdated"        to r.performancesUpdated,
                "playersSkippedNotInDb"      to r.playersSkippedNotInDb,
                "playersSkippedNotInDbNames" to r.playersSkippedNotInDbNames,
                "playersSkippedAlreadySaved" to r.playersSkippedAlreadySaved,
                "matchId"                    to r.matchId,
                "matchLabel"                 to r.matchLabel,
                "reason"                     to r.reason
            )
        )
    }

    /**
     * Re-syncs only the "Fantasy Points" sheet tab from DB data.
     */
    @PostMapping("/sync-points-sheet")
    fun syncPointsSheet(): ResponseEntity<Any> {
        val summary = sheetsSyncService.syncToSheet()
        sheetsSyncService.syncAuctionTabs()
        return ResponseEntity.ok(
            mapOf(
                "message" to "Fantasy Points sheet synced successfully",
                "summary" to mapOf(
                    "performancesUsed"     to summary.performancesUsed,
                    "matchColumns"         to summary.matchColumns,
                    "playerRowsWritten"    to summary.playerRowsWritten,
                    "ipl2026MatchesInDb"  to summary.ipl2026MatchesInDb
                )
            )
        )
    }

    /**
     * One-shot maintenance endpoint:
     * 1) Recalculate all fantasy points from score stats
     * 2) Rebuild player totals
     * 3) Sync Fantasy/auction/fixtures Google Sheet tabs
     */
    @PostMapping("/rebuild-and-sync-all")
    fun rebuildAndSyncAll(
        @RequestParam(name = "season", required = false, defaultValue = "2026") season: String
    ): ResponseEntity<Any> {
        val r = fantasyCronService.rebuildSeasonAndSyncAll(season.trim())
        return ResponseEntity.ok(
            mapOf(
                "ok" to r.ok,
                "message" to r.message,
                "season" to r.season,
                "performancesScanned" to r.performancesScanned,
                "performancesUpdated" to r.performancesUpdated,
                "totalPointsBefore" to r.totalPointsBefore,
                "totalPointsAfter" to r.totalPointsAfter,
                "playersWithTotals" to r.playersWithTotals,
                "sheetSyncOk" to r.sheetSyncOk
            )
        )
    }

    // ── Player CSV exports ────────────────────────────────────────────────────

    @GetMapping("/scrape-to-csv")
    fun scrapeToCSV(response: jakarta.servlet.http.HttpServletResponse) {
        val csv = scraperService.scrapeToCSV()
        response.contentType = "text/csv"
        response.setHeader("Content-Disposition", "attachment; filename=\"IPL_2026_Players.csv\"")
        response.writer.write(csv)
        response.writer.flush()
    }

    @GetMapping("/export-players-csv")
    fun exportPlayersCSV(response: jakarta.servlet.http.HttpServletResponse) {
        val players = playerRepository.findAll()
        response.contentType = "text/csv"
        response.setHeader("Content-Disposition", "attachment; filename=\"IPL_2026_Players.csv\"")

        val writer = response.writer
        writer.println("name,specialism,iplTeam,country,age,battingStyle,bowlingStyle,testCaps,odiCaps,t20Caps")
        players.forEach { p ->
            fun String?.csv() = this?.replace(",", " ") ?: ""
            writer.println(
                "${p.name.csv()},${p.specialism.csv()},${p.iplTeam.csv()},${p.country.csv()}," +
                "${p.age ?: ""},${p.battingStyle.csv()},${p.bowlingStyle.csv()}," +
                "${p.testCaps},${p.odiCaps},${p.t20Caps}"
            )
        }
        writer.flush()
    }

    @PostMapping("/sync-upcoming")
    fun syncUpcoming(): ResponseEntity<Map<String, Any>> {
        val saved = iplScraperService.syncUpcomingMatches()
        return ResponseEntity.ok(mapOf(
            "message" to "Upcoming match sync complete",
            "inserted" to saved
        ))
    }
}
