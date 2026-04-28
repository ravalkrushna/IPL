package com.example.ipl_backend.dto

import java.math.BigDecimal

// ── Leaderboard ───────────────────────────────────────────────────────────────

data class FantasyLeaderboardEntry(
    val rank: Int,
    val squadId: String,
    val squadName: String,
    val participantName: String,
    val totalPoints: Int,
    val matchesPlayed: Int,
    val lockedPoints: Int = 0,
    val newPoints: Int = 0
)

data class FantasyLeaderboardResponse(
    val auctionId: String,
    val entries: List<FantasyLeaderboardEntry>
)

// ── Squad breakdown ───────────────────────────────────────────────────────────

data class FantasySquadPlayerEntry(
    val playerId: String,
    val playerName: String,
    val specialism: String,
    val iplTeam: String,
    val soldPrice: BigDecimal,
    val totalPoints: Int,
    val matchesPlayed: Int,
    // Epoch-millis of when this player joined the squad via trade.
    // 0 = original auction buy (points counted from season start).
    // >0 = mid-season trade arrival; only points from matches on/after this date count.
    val joinedAt: Long = 0L
)

data class FantasySquadResponse(
    val squadId: String,
    val squadName: String,
    val auctionId: String,
    val totalPoints: Int,
    val lockedPoints: Int = 0,
    val newPoints: Int = 0,
    val players: List<FantasySquadPlayerEntry>
)

data class FantasySquadPreviousSquadResponse(
    val squadId: String,
    val squadName: String,
    val auctionId: String,
    val lockedPoints: Int,
    val players: List<FantasySquadPlayerEntry>
)

// ── Player match-by-match ─────────────────────────────────────────────────────

/** Per-category fantasy points for one match (Dream11 IPL–style components). */
data class FantasyPointBreakdown(
    val playingXi: Int,
    val batting: Int,
    val bowling: Int,
    val fielding: Int
)

data class FantasyPlayerMatchEntry(
    val matchId: String,
    val matchNo: Int,
    val teamA: String,
    val teamB: String,
    val matchDate: Long,
    val runs: Int,
    val ballsFaced: Int,
    val fours: Int,
    val sixes: Int,
    val dismissed: Boolean,
    val wickets: Int,
    val dotBalls: Int,
    val catches: Int,
    val stumpings: Int,
    val runOutsDirect: Int,
    val runOutsIndirect: Int,
    val fantasyPoints: Int,
    val pointBreakdown: FantasyPointBreakdown? = null
)

data class FantasyPlayerResponse(
    val playerId: String,
    val playerName: String,
    val iplTeam: String,
    val specialism: String,
    val totalPoints: Int,
    val matchesPlayed: Int,
    val matches2025: List<FantasyPlayerMatchEntry>,
    val matches2026: List<FantasyPlayerMatchEntry>,
)


// ── Match performances ────────────────────────────────────────────────────────

data class FantasyMatchPlayerEntry(
    val playerId: String,
    val playerName: String,
    val iplTeam: String,
    val specialism: String,
    val runs: Int,
    val ballsFaced: Int,
    val fours: Int,
    val sixes: Int,
    val dismissed: Boolean,
    val wickets: Int,
    val dotBalls: Int,
    val lbwBowledCount: Int,
    val oversBowled: BigDecimal,
    val runsGiven: Int,
    val maidens: Int,
    val catches: Int,
    val stumpings: Int,
    val runOutsDirect: Int,
    val runOutsIndirect: Int,
    val fantasyPoints: Int
)

data class FantasyMatchResponse(
    val matchId: String,
    val matchNo: Int,
    val teamA: String,
    val teamB: String,
    val matchDate: Long,
    val performances: List<FantasyMatchPlayerEntry>
)