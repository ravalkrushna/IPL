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
        // IPL Dream11 table: Boundary Bonus +4 per four, Six Bonus +6 per six.
        pts += p.fours * 4
        pts += p.sixes * 6

        when {
            p.runs >= 100 -> pts += 16
            p.runs >= 75  -> pts += 12
            p.runs >= 50  -> pts += 8
            p.runs >= 25  -> pts += 4
        }

        if (p.runs == 0 && p.dismissed) pts -= 2

        // IPL Dream11: Strike Rate (except bowler) — min 10 balls to be played.
        // Positive bonuses for high SR + negative only for SR <= 70.
        if (p.ballsFaced >= 10) {
            val sr = (p.runs.toDouble() / p.ballsFaced) * 100.0
            pts += iplBattingStrikeRateAdjustment(sr)
        }

        return pts
    }

    /**
     * IPL Dream11 Strike Rate table (min 10 balls):
     * - Above 170 per 100 balls: +6
     * - Between 150-170 per 100 balls: +4
     * - Between 130-150 per 100 balls: +2
     * - Between 60-70 per 100 balls: -2
     * - Between 50-59.99 per 100 balls: -4
     * - Below 50 per 100 balls: -6
     */
    private fun iplBattingStrikeRateAdjustment(sr: Double): Int =
        when {
            sr > 170.0  -> 6
            sr > 150.0  -> 4
            sr > 130.0  -> 2
            sr > 70.0   -> 0
            sr >= 60.0  -> -2
            sr >= 50.0  -> -4
            else        -> -6
        }

    private fun bowlingPoints(p: PlayerMatchPerformance): Int {
        var pts = 0

        // IPL Dream11 bowling table:
        // Wicket (Excluding Run Out) +30
        // Bonus (LBW/Bowled) +8
        // 3 Wicket Bonus +4, 4 Wicket Bonus +8, 5 Wicket Bonus +12
        // Maiden Over +12
        pts += p.wickets * 30

        // Dream11 table bonuses are tiers (not additive): 3wk +4, 4wk +8, 5wk +12.
        pts += when {
            p.wickets >= 5 -> 12
            p.wickets >= 4 -> 8
            p.wickets >= 3 -> 4
            else            -> 0
        }

        pts += p.lbwBowledCount * 8

        pts += p.maidens * 12

        val oversDouble = p.oversBowled.toDouble()
        if (oversDouble >= 2.0) {
            val economy = p.runsGiven.toDouble() / oversDouble
            pts += iplEconomyPoints(economy)
        }

        return pts
    }

    /**
     * IPL Dream11 Economy Rate table (min 2 overs to be bowled):
     * - Below 5: +6
     * - 5.00–5.99: +4
     * - 6.00–6.99: +2
     * - 7.00–10.99: -2 (table shown as 7–10 and 10–11)
     * - 11.01–11.99: -4
     * - Above 12: -6
     *
     * Note: Your model doesn’t currently include “dot balls”, so we can’t implement the Bowling “Dot Ball +1” rule.
     */
    private fun iplEconomyPoints(economy: Double): Int =
        when {
            economy < 5.0  -> 6
            economy < 6.0  -> 4
            economy < 8.0  -> 2
            economy < 11.0 -> -2
            economy < 12.0 -> -4
            else           -> -6
        }

    private fun fieldingPoints(p: PlayerMatchPerformance): Int {
        var pts = 0
        pts += p.catches * 8
        // IPL Dream11: 3 Catch Bonus +4
        if (p.catches >= 3) pts += 4
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

    // Example: 50 runs, 30 balls, 4 fours, 2 sixes
    val rohit = PlayerMatchPerformance(
        id = "1", playerId = "p1", matchId = "m1",
        runs = 50, ballsFaced = 30, fours = 4, sixes = 2,
        dismissed = false, wickets = 0, lbwBowledCount = 0,
        oversBowled = BigDecimal.ZERO, runsGiven = 0, maidens = 0,
        catches = 0, stumpings = 0, runOutsDirect = 0, runOutsIndirect = 0,
        playingXi = true, fantasyPoints = 0, createdAt = 0L
    )
    println("Rohit example: ${calculator.calculate(rohit)} pts")
    println(calculator.breakdown(rohit))

    // Example: 5 wickets, 4 overs / 20 runs
    val bumrah = PlayerMatchPerformance(
        id = "2", playerId = "p2", matchId = "m1",
        runs = 0, ballsFaced = 0, fours = 0, sixes = 0,
        dismissed = false, wickets = 5, lbwBowledCount = 2,
        oversBowled = BigDecimal("4.0"), runsGiven = 20, maidens = 1,
        catches = 0, stumpings = 0, runOutsDirect = 0, runOutsIndirect = 0,
        playingXi = true, fantasyPoints = 0, createdAt = 0L
    )
    println("Bumrah example: ${calculator.calculate(bumrah)} pts")
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