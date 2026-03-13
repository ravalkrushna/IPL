package com.example.ipl_backend.model

import org.jetbrains.exposed.sql.Table

object PlayerMatchPerformances : Table("player_match_performances") {

    val id       = varchar("id", 255)
    val playerId = varchar("player_id", 255).references(Players.id)
    val matchId  = varchar("match_id", 255).references(IplMatches.id)

    // ── Batting ───────────────────────────────────────────────────────────
    val runs        = integer("runs").default(0)
    val ballsFaced  = integer("balls_faced").default(0)
    val fours       = integer("fours").default(0)
    val sixes       = integer("sixes").default(0)
    val dismissed   = bool("dismissed").default(false)

    // ── Bowling ───────────────────────────────────────────────────────────
    val wickets         = integer("wickets").default(0)
    val lbwBowledCount  = integer("lbw_bowled_count").default(0)  // subset of wickets that were LBW or bowled
    val oversBowled     = decimal("overs_bowled", 4, 1).default(java.math.BigDecimal.ZERO)
    val runsGiven       = integer("runs_given").default(0)
    val maidens         = integer("maidens").default(0)

    // ── Fielding ──────────────────────────────────────────────────────────
    val catches          = integer("catches").default(0)
    val stumpings        = integer("stumpings").default(0)
    val runOutsDirect    = integer("run_outs_direct").default(0)
    val runOutsIndirect  = integer("run_outs_indirect").default(0)

    // ── Meta ──────────────────────────────────────────────────────────────
    val playingXi     = bool("playing_xi").default(true)
    val fantasyPoints = integer("fantasy_points").default(0)
    val createdAt     = long("created_at")

    override val primaryKey = PrimaryKey(id)

    init {
        uniqueIndex(playerId, matchId)  // one row per player per match
    }
}

data class PlayerMatchPerformance(
    val id: String,
    val playerId: String,
    val matchId: String,

    val runs: Int,
    val ballsFaced: Int,
    val fours: Int,
    val sixes: Int,
    val dismissed: Boolean,

    val wickets: Int,
    val lbwBowledCount: Int,
    val oversBowled: java.math.BigDecimal,
    val runsGiven: Int,
    val maidens: Int,

    val catches: Int,
    val stumpings: Int,
    val runOutsDirect: Int,
    val runOutsIndirect: Int,

    val playingXi: Boolean,
    val fantasyPoints: Int,
    val createdAt: Long
)