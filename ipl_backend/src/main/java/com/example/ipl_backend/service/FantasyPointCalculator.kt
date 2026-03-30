package com.example.ipl_backend.service

import com.example.ipl_backend.model.PlayerMatchPerformance
import org.springframework.stereotype.Service
import java.math.BigDecimal

/**
 * Fantasy points for **TATA IPL** as published under Dream11’s cricket point system
 * (Dream11 → Fantasy Cricket → Point System → IPL tab:
 * [dream11.com/fantasy-cricket/point-system](https://www.dream11.com/fantasy-cricket/point-system)).
 *
 * Differences from generic T20 on the same page: IPL uses +1 per boundary, no LBW/bowled wicket bonus,
 * no 3-wicket haul bonus, maiden +8, economy rewards only two bands (no high-economy penalties in the IPL table),
 * and batting strike-rate changes are **penalties only** for SR ≤ 70 (no high-SR bonus).
 */
@Service
class FantasyPointsCalculator {

    fun calculate(p: PlayerMatchPerformance): Int =
        playingXiPoints(p) + battingPoints(p) + bowlingPoints(p) + fieldingPoints(p)

    private fun playingXiPoints(p: PlayerMatchPerformance): Int =
        if (p.playingXi) 4 else 0

    private fun battingPoints(p: PlayerMatchPerformance): Int {
        var pts = 0

        pts += p.runs
        pts += p.fours
        pts += p.sixes * 2

        when {
            p.runs >= 100 -> pts += 16
            p.runs >= 50  -> pts += 8
        }

        if (p.runs == 0 && p.dismissed) pts -= 2

        if (p.ballsFaced >= 10) {
            val sr = (p.runs.toDouble() / p.ballsFaced) * 100
            pts += iplBattingStrikeRateAdjustment(sr)
        }

        return pts
    }

    /** IPL: penalties only for SR ≤ 70; below 50: -6; 50–59.99: -4; 60–70: -2. */
    private fun iplBattingStrikeRateAdjustment(sr: Double): Int =
        when {
            sr < 50.0  -> -6
            sr < 60.0  -> -4
            sr <= 70.0 -> -2
            else       -> 0
        }

    private fun bowlingPoints(p: PlayerMatchPerformance): Int {
        var pts = 0

        pts += p.wickets * 25

        if (p.wickets >= 4) pts += 8
        if (p.wickets >= 5) pts += 16

        pts += p.maidens * 8

        val oversDouble = p.oversBowled.toDouble()
        if (oversDouble >= 2.0) {
            val economy = p.runsGiven.toDouble() / oversDouble
            pts += iplEconomyPoints(economy)
        }

        return pts
    }

    /**
     * IPL (min 2 overs): Dream11 lists two reward bands (~4–5 rpo and ~5–6 rpo).
     * Implemented as +4 for [4, 5), +2 for [5, 6]; below 4 rpo treated as top tier (+4).
     */
    private fun iplEconomyPoints(economy: Double): Int =
        when {
            economy < 5.0  -> 4
            economy <= 6.0 -> 2
            else           -> 0
        }

    private fun fieldingPoints(p: PlayerMatchPerformance): Int {
        var pts = 0
        pts += p.catches * 8
        pts += p.stumpings * 12
        pts += p.runOutsDirect * 12
        pts += p.runOutsIndirect * 6
        return pts
    }

    data class PointsBreakdown(
        val playingXi: Int,
        val batting: Int,
        val bowling: Int,
        val fielding: Int,
        val total: Int
    )

    fun breakdown(p: PlayerMatchPerformance): PointsBreakdown {
        val playingXiPts = playingXiPoints(p)
        val battingPts   = battingPoints(p)
        val bowlingPts   = bowlingPoints(p)
        val fieldingPts  = fieldingPoints(p)
        return PointsBreakdown(
            playingXi = playingXiPts,
            batting   = battingPts,
            bowling   = bowlingPts,
            fielding  = fieldingPts,
            total     = playingXiPts + battingPts + bowlingPts + fieldingPts
        )
    }
}

fun main() {
    val calculator = FantasyPointsCalculator()

    // 50 runs, 30 balls, 4 fours, 2 sixes — IPL: no high-SR bonus (SR ~166)
    val rohit = PlayerMatchPerformance(
        id = "1", playerId = "p1", matchId = "m1",
        runs = 50, ballsFaced = 30, fours = 4, sixes = 2,
        dismissed = false, wickets = 0, lbwBowledCount = 0,
        oversBowled = BigDecimal.ZERO, runsGiven = 0, maidens = 0,
        catches = 0, stumpings = 0, runOutsDirect = 0, runOutsIndirect = 0,
        playingXi = true, fantasyPoints = 0, createdAt = 0L
    )
    println("Rohit 50: ${calculator.calculate(rohit)} pts (IPL: 4 XI + 50 + 4 + 4 + 8 fifty = 70)")
    println(calculator.breakdown(rohit))

    // 5 wkts, 4 ov / 20 runs → ER 5.0 → +2; maidens +8 each; 4fer +8 and 5fer +16 (stacked)
    val bumrah = PlayerMatchPerformance(
        id = "2", playerId = "p2", matchId = "m1",
        runs = 0, ballsFaced = 0, fours = 0, sixes = 0,
        dismissed = false, wickets = 5, lbwBowledCount = 2,
        oversBowled = BigDecimal("4.0"), runsGiven = 20, maidens = 1,
        catches = 0, stumpings = 0, runOutsDirect = 0, runOutsIndirect = 0,
        playingXi = true, fantasyPoints = 0, createdAt = 0L
    )
    println("Bumrah 5-fer: ${calculator.calculate(bumrah)} pts (4+125+24+8+2 = 163)")
    println(calculator.breakdown(bumrah))

    val duck = PlayerMatchPerformance(
        id = "3", playerId = "p3", matchId = "m1",
        runs = 0, ballsFaced = 3, fours = 0, sixes = 0,
        dismissed = true, wickets = 0, lbwBowledCount = 0,
        oversBowled = BigDecimal.ZERO, runsGiven = 0, maidens = 0,
        catches = 0, stumpings = 0, runOutsDirect = 0, runOutsIndirect = 0,
        playingXi = true, fantasyPoints = 0, createdAt = 0L
    )
    println("Duck: ${calculator.calculate(duck)} pts (4 XI - 2 duck = 2)")
    println(calculator.breakdown(duck))
}