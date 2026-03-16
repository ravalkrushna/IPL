package com.example.ipl_backend.dto

import java.math.BigDecimal

// ── Leaderboard ───────────────────────────────────────────────────────────────

data class FantasyLeaderboardEntry(
    val rank: Int,
    val squadId: String,
    val squadName: String,
    val participantName: String,
    val totalPoints: Int,
    val matchesPlayed: Int
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
    val matchesPlayed: Int
)

data class FantasySquadResponse(
    val squadId: String,
    val squadName: String,
    val auctionId: String,
    val totalPoints: Int,
    val players: List<FantasySquadPlayerEntry>
)

// ── Player match-by-match ─────────────────────────────────────────────────────

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
    val catches: Int,
    val stumpings: Int,
    val runOutsDirect: Int,
    val runOutsIndirect: Int,
    val fantasyPoints: Int
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