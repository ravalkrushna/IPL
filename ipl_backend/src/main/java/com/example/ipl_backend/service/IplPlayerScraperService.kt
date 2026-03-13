package com.example.ipl_backend.service

import com.example.ipl_backend.model.BidLogs
import com.example.ipl_backend.model.Bids
import com.example.ipl_backend.model.Player
import com.example.ipl_backend.model.Players
import com.example.ipl_backend.model.SquadPlayers
import com.example.ipl_backend.model.Squads
import com.example.ipl_backend.repository.PlayerRepository
import org.jetbrains.exposed.sql.deleteAll
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.transaction
import org.jsoup.Jsoup
import org.jsoup.nodes.Document
import org.springframework.stereotype.Component
import java.math.BigDecimal
import java.time.Instant
import java.util.*

@Component
class IplPlayerScraperService(
    private val playerRepository: PlayerRepository
) {

    // ── Role mapping ──────────────────────────────────────────────────────
    private val ROLE_MAP = mapOf(
        "Batter"                  to "BATSMAN",
        "Batsman"                 to "BATSMAN",
        "Bowler"                  to "BOWLER",
        "All-Rounder"             to "ALLROUNDER",
        "Allrounder"              to "ALLROUNDER",
        "All Rounder"             to "ALLROUNDER",
        "WK-Batter"               to "WICKETKEEPER",
        "Wicketkeeper Batter"     to "WICKETKEEPER",
        "Wicket-Keeper"           to "WICKETKEEPER",
        "WK-Batsman"              to "WICKETKEEPER",
    )

    // ── All 10 IPL 2026 teams ─────────────────────────────────────────────
    private val IPL_TEAMS = mapOf(
        "Mumbai Indians"              to "mumbai-indians",
        "Chennai Super Kings"         to "chennai-super-kings",
        "Royal Challengers Bengaluru" to "royal-challengers-bengaluru",
        "Kolkata Knight Riders"       to "kolkata-knight-riders",
        "Delhi Capitals"              to "delhi-capitals",
        "Punjab Kings"                to "punjab-kings",
        "Rajasthan Royals"            to "rajasthan-royals",
        "Sunrisers Hyderabad"         to "sunrisers-hyderabad",
        "Gujarat Titans"              to "gujarat-titans",
        "Lucknow Super Giants"        to "lucknow-super-giants",
    )

    private val FLAT_BASE_PRICE = BigDecimal("5000000")  // ₹50 Lakhs

    // ── Intermediate model with profile URL ───────────────────────────────
    data class ScrapedPlayer(
        val name: String,
        val role: String,
        val iplTeam: String,
        val profileUrl: String?,   // e.g. https://www.iplt20.com/players/rohit-sharma/107
    )

    // ── Full enriched player data from profile page ───────────────────────
    data class PlayerProfile(
        val country: String?,
        val age: Int?,
        val battingStyle: String?,
        val bowlingStyle: String?,
        val testCaps: Int,
        val odiCaps: Int,
        val t20Caps: Int,
    )

    // ─────────────────────────────────────────────────────────────────────
    // Main entry point
    // ─────────────────────────────────────────────────────────────────────
    fun seed() {
        val count = transaction { Players.selectAll().count() }
        if (count > 0) {
            println("⏭️  Players already seeded ($count players) — skipping scrape")
            return
        }

        println("🏏 Starting IPL 2026 player scrape from iplt20.com...")

        val allPlayers = mutableListOf<ScrapedPlayer>()
        for ((teamName, slug) in IPL_TEAMS) {
            val players = scrapeTeamSquad(teamName, slug)
            allPlayers.addAll(players)
            println("  ✅ $teamName: ${players.size} players scraped from squad page")
            Thread.sleep(1500)
        }

        println("📊 Total from squad pages: ${allPlayers.size} players")

        if (allPlayers.isEmpty()) {
            println("⚠️  No players scraped — aborting")
            return
        }

        println("🗑️  Clearing old data...")
        transaction {
            BidLogs.deleteAll()
            Bids.deleteAll()
            SquadPlayers.deleteAll()
            Squads.deleteAll()
            Players.deleteAll()
        }

        println("🔍 Enriching players from individual profile pages...")
        println("   (This will take ~${allPlayers.size * 2}s due to polite delays)\n")

        var inserted = 0
        var skipped  = 0
        val now = Instant.now().toEpochMilli()

        for ((index, p) in allPlayers.withIndex()) {
            try {
                val specialism = ROLE_MAP[p.role] ?: "BATSMAN"

                // ── Fetch full profile if URL is available ────────────────
                val profile = if (p.profileUrl != null) {
                    fetchPlayerProfile(p.profileUrl).also {
                        Thread.sleep(1200)   // polite delay between profile fetches
                    }
                } else {
                    PlayerProfile(null, null, null, null, 0, 0, 0)
                }

                val player = Player(
                    id           = UUID.randomUUID().toString(),
                    name         = p.name,
                    country      = profile.country,
                    age          = profile.age,
                    specialism   = specialism,
                    battingStyle = profile.battingStyle,
                    bowlingStyle = profile.bowlingStyle,
                    testCaps     = profile.testCaps,
                    odiCaps      = profile.odiCaps,
                    t20Caps      = profile.t20Caps,
                    basePrice    = FLAT_BASE_PRICE,
                    isSold       = false,
                    isAuctioned  = false,
                    iplTeam      = p.iplTeam,
                    createdAt    = now,
                    updatedAt    = now,
                )

                playerRepository.save(player)
                inserted++

                if (index % 10 == 0) {
                    println("   ⏳ Progress: $inserted/${allPlayers.size} inserted...")
                }

            } catch (e: Exception) {
                println("  ❌ Failed to insert ${p.name}: ${e.message}")
                skipped++
            }
        }

        println("")
        println("🎉 Seed complete!")
        println("   ✅ Inserted : $inserted")
        println("   ⚠️  Skipped  : $skipped")
    }

    // ─────────────────────────────────────────────────────────────────────
    // Step 1 — scrape squad page to get player names + profile URLs
    // ─────────────────────────────────────────────────────────────────────
    private fun scrapeTeamSquad(teamName: String, slug: String): List<ScrapedPlayer> {
        val url = "https://www.iplt20.com/teams/$slug/squad"
        return try {
            val doc = fetchDoc(url)
            val players = mutableListOf<ScrapedPlayer>()

            // Each player card: <li> containing div.ih-p-name > h2 (name) and a sibling span (role)
            // Profile link is on the <a> wrapping the card
            val playerCards = doc.select("li:has(div.ih-p-name)")

            for (card in playerCards) {
                val name = card.select("div.ih-p-name h2").text().trim()
                if (name.isBlank()) continue

                val roleEl = card.select("div.ih-p-name").firstOrNull()
                    ?.nextElementSibling()
                val role = roleEl?.text()?.trim() ?: "Batter"

                // Profile URL — look for <a href="/players/...">
                val href = card.select("a[href*='/players/']").attr("href").trim()
                val profileUrl = when {
                    href.isBlank() -> null
                    href.startsWith("http") -> href
                    else -> "https://www.iplt20.com$href"
                }

                players.add(ScrapedPlayer(name = name, role = role, iplTeam = teamName, profileUrl = profileUrl))
            }

            // Fallback if primary selector finds nothing
            if (players.isEmpty()) {
                println("  ⚠️  Primary selector empty for $teamName, trying fallback...")
                val nameEls = doc.select("div.ih-p-name h2")
                for (el in nameEls) {
                    val name = el.text().trim()
                    if (name.isBlank()) continue
                    val role = el.parent()?.nextElementSibling()?.text()?.trim() ?: "Batter"
                    val href = el.parents().select("a[href*='/players/']").attr("href").trim()
                    val profileUrl = if (href.isNotBlank()) "https://www.iplt20.com$href" else null
                    players.add(ScrapedPlayer(name = name, role = role, iplTeam = teamName, profileUrl = profileUrl))
                }
            }

            players
        } catch (e: Exception) {
            println("  ❌ Failed to scrape squad for $teamName: ${e.message}")
            emptyList()
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Step 2 — scrape individual profile page for full stats
    //
    // Example page: https://www.iplt20.com/players/rohit-sharma/107
    // The page contains:
    //   - Nationality (e.g. "Indian" or country name)
    //   - Date of Birth  → we derive age from this
    //   - Matches played (T20 caps proxy)
    //   - Player Details popup has batting/bowling style
    // ─────────────────────────────────────────────────────────────────────
    private fun fetchPlayerProfile(profileUrl: String): PlayerProfile {
        return try {
            val doc = fetchDoc(profileUrl)

            // ── Country ──────────────────────────────────────────────────
            // Appears as plain text just below the player name heading,
            // e.g. <p class="ih-p-ct">Indian</p> or similar
            val country = extractCountry(doc)

            // ── Date of Birth → Age ───────────────────────────────────────
            // "30 April 1987" format inside player overview section
            val age = extractAge(doc)

            // ── T20 Matches (used as T20 caps proxy) ─────────────────────
            // "272 Matches" shown in the overview section
            val t20Caps = extractT20Caps(doc)

            // ── Batting / Bowling Style ───────────────────────────────────
            // Inside the hidden "Player Details" popup table:
            // | Role | Batsman | Nationality | Indian |
            // | Bats | Right-hand bat | Bowls | Right-arm medium |
            val (battingStyle, bowlingStyle) = extractStyles(doc)

            PlayerProfile(
                country      = country,
                age          = age,
                battingStyle = battingStyle,
                bowlingStyle = bowlingStyle,
                testCaps     = 0,    // iplt20.com doesn't show format-wise caps
                odiCaps      = 0,    // use a stats API (CricAPI) for these if needed
                t20Caps      = t20Caps,
            )

        } catch (e: Exception) {
            println("    ⚠️  Could not fetch profile $profileUrl: ${e.message}")
            PlayerProfile(null, null, null, null, 0, 0, 0)
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Extraction helpers
    // ─────────────────────────────────────────────────────────────────────

    private val KNOWN_ROLES = setOf(
    "batter", "batsman", "bowler",
    "all rounder", "allrounder", "all-rounder",
    "wicketkeeper batter", "wicketkeeper batsman",
    "wk-batter", "wk-batsman", "wicket-keeper",
    "wicket keeper", "wicketkeeper",
    "batting allrounder", "bowling allrounder",
    "batting all-rounder", "bowling all-rounder",
)

    private fun extractCountry(doc: Document): String? {
    val raw = doc.select(".ih-p-det p, .player-profile-det p, h1 + p, h1 + div p")
        .map { it.text().trim() }
        .firstOrNull {
            it.matches(Regex("[A-Za-z ]+"))
                && it.length in 3..30
                && !it.contains("IPL")
                && it.lowercase() !in KNOWN_ROLES
                && !it.lowercase().contains("batter")
                && !it.lowercase().contains("batsman")
                && !it.lowercase().contains("bowler")
                && !it.lowercase().contains("rounder")
                && !it.lowercase().contains("keeper")
        }

        return when (raw?.lowercase()) {
            "indian"                    -> "India"
            "australian"                -> "Australia"
            "english"                   -> "England"
            "south african"             -> "South Africa"
            "new zealander", "new zealand" -> "New Zealand"
            "west indian"               -> "West Indies"
            "sri lankan"                -> "Sri Lanka"
            "afghan", "afghani"         -> "Afghanistan"
            "bangladeshi"               -> "Bangladesh"
            "pakistani"                 -> "Pakistan"
            else                        -> raw?.replaceFirstChar { it.uppercase() }
        }
    }

    private fun extractAge(doc: Document): Int? {
        // Find text matching "DD Month YYYY" pattern anywhere in the page
        val dobPattern = Regex("""(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})""")
        val pageText = doc.text()
        val match = dobPattern.find(pageText) ?: return null

        val day   = match.groupValues[1].toIntOrNull() ?: return null
        val month = listOf("January","February","March","April","May","June",
            "July","August","September","October","November","December")
            .indexOf(match.groupValues[2]) + 1
        val year  = match.groupValues[3].toIntOrNull() ?: return null

        val today = java.time.LocalDate.now()
        val dob   = java.time.LocalDate.of(year, month, day)
        return java.time.Period.between(dob, today).years
    }

    private fun extractT20Caps(doc: Document): Int {
        // iplt20.com shows "272 Matches" in the overview stats block
        // We look for a number preceding or near the word "Matches"
        val matchesPattern = Regex("""(\d+)\s*Matches""")
        val match = matchesPattern.find(doc.text()) ?: return 0
        return match.groupValues[1].toIntOrNull() ?: 0
    }

    private fun extractStyles(doc: Document): Pair<String?, String?> {
        // The player detail popup table has rows like:
        // Bats | Right-hand bat    Bowls | Right-arm medium
        var batting: String? = null
        var bowling: String? = null

        val rows = doc.select("table tr, .player-detail-row, .ih-pd-item")
        for (row in rows) {
            val text = row.text().lowercase()
            when {
                text.contains("bats") || text.contains("batting") -> {
                    batting = row.select("td, span, div")
                        .map { it.text().trim() }
                        .firstOrNull { it.contains("hand", ignoreCase = true) }
                }
                text.contains("bowls") || text.contains("bowling") -> {
                    bowling = row.select("td, span, div")
                        .map { it.text().trim() }
                        .firstOrNull {
                            it.contains("arm", ignoreCase = true) ||
                                    it.contains("spin", ignoreCase = true) ||
                                    it.contains("medium", ignoreCase = true)
                        }
                }
            }
        }

        // Fallback: scan raw text for known batting/bowling patterns
        if (batting == null) {
            val m = Regex("""(Right|Left)[- ]hand(ed)? bat""", RegexOption.IGNORE_CASE).find(doc.text())
            batting = m?.value
        }
        if (bowling == null) {
            val m = Regex("""(Right|Left)[- ]arm (fast|medium|off[- ]spin|leg[- ]spin|slow left|orthodox|unorthodox|chinaman)""", RegexOption.IGNORE_CASE).find(doc.text())
            bowling = m?.value
        }

        return Pair(batting, bowling)
    }

    fun scrapeToCSV(): String {
        println("🏏 Scraping IPL 2026 squads for CSV export...")

        val allPlayers = mutableListOf<ScrapedPlayer>()
        for ((teamName, slug) in IPL_TEAMS) {
            val players = scrapeTeamSquad(teamName, slug)
            allPlayers.addAll(players)
            println("  ✅ $teamName: ${players.size} players")
            Thread.sleep(1500)
        }

        println("🔍 Enriching ${allPlayers.size} players from profile pages...")

        val sb = StringBuilder()
        sb.appendLine("name,specialism,iplTeam,country,age,battingStyle,bowlingStyle,testCaps,odiCaps,t20Caps")

        for ((index, p) in allPlayers.withIndex()) {
            val specialism = ROLE_MAP[p.role] ?: "BATSMAN"
            val profile = if (p.profileUrl != null) {
                try {
                    fetchPlayerProfile(p.profileUrl).also { Thread.sleep(1200) }
                } catch (e: Exception) {
                    println("  ⚠️  Failed profile for ${p.name}: ${e.message}")
                    PlayerProfile(null, null, null, null, 0, 0, 0)
                }
            } else {
                PlayerProfile(null, null, null, null, 0, 0, 0)
            }

            fun String?.csv() = this?.replace(",", " ") ?: ""

            sb.appendLine(
                "${p.name.csv()},$specialism,${p.iplTeam.csv()},${profile.country.csv()}," +
                        "${profile.age ?: ""},${profile.battingStyle.csv()},${profile.bowlingStyle.csv()}," +
                        "${profile.testCaps},${profile.odiCaps},${profile.t20Caps}"
            )

            if (index % 10 == 0) println("   ⏳ ${index + 1}/${allPlayers.size} done...")
        }

        println("✅ CSV generation complete — ${allPlayers.size} players")
        return sb.toString()
    }

    // ─────────────────────────────────────────────────────────────────────
    // Shared Jsoup fetch with browser-like headers
    // ─────────────────────────────────────────────────────────────────────
    private fun fetchDoc(url: String): Document =
        Jsoup.connect(url)
            .userAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .header("Accept-Language", "en-US,en;q=0.9")
            .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
            .timeout(15_000)
            .get()
}