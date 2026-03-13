package com.example.ipl_backend.service

import com.example.ipl_backend.model.PlayerMatchPerformance
import org.springframework.stereotype.Service

@Service
class FantasyPointsCalculator {

    fun calculate(p: PlayerMatchPerformance): Int {
        var points = 0

        // ── Playing XI ────────────────────────────────────────────────────
        if (p.playingXi) points += 4

        // ── Batting ───────────────────────────────────────────────────────
        points += p.runs                        // +1 per run
        points += p.fours                       // +1 per four
        points += p.sixes * 2                   // +2 per six

        if (p.runs >= 100) points += 16         // century bonus
        else if (p.runs >= 50) points += 8      // half-century bonus

        if (p.runs == 0 && p.dismissed) points -= 2  // duck penalty

        // Strike rate bonus/penalty (minimum 10 balls faced)
        if (p.ballsFaced >= 10) {
            val sr = (p.runs.toDouble() / p.ballsFaced) * 100
            points += when {
                sr > 170  ->  6
                sr >= 150 ->  4
                sr >= 130 ->  2
                sr in 50.0..60.0  -> -4
                sr in 60.0..70.0  -> -2
                sr < 50   -> -6
                else      ->  0
            }
        }

        // ── Bowling ───────────────────────────────────────────────────────
        points += p.wickets * 25                // +25 per wicket
        points += p.lbwBowledCount * 8          // +8 bonus for LBW or bowled dismissals
        points += p.maidens * 4                 // +4 per maiden

        // Wicket milestone bonus
        points += when {
            p.wickets >= 5 -> 16
            p.wickets >= 4 ->  8
            p.wickets >= 3 ->  4
            else           ->  0
        }

        // Economy bonus/penalty (minimum 2 overs = 12 balls)
        val oversDouble = p.oversBowled.toDouble()
        if (oversDouble >= 2.0) {
            val economy = p.runsGiven.toDouble() / oversDouble
            points += when {
                economy < 5  ->  6
                economy < 6  ->  4
                economy < 7  ->  2
                economy in 10.0..11.0 -> -2
                economy in 11.0..12.0 -> -4
                economy > 12 -> -6
                else         ->  0
            }
        }

        // ── Fielding ──────────────────────────────────────────────────────
        points += p.catches * 8                 // +8 per catch
        if (p.catches >= 3) points += 4         // 3-catch bonus
        points += p.stumpings * 12              // +12 per stumping
        points += p.runOutsDirect * 12          // +12 direct run out
        points += p.runOutsIndirect * 6         // +6 indirect run out

        return points
    }

    // ── Breakdown for debugging / UI drilldown ────────────────────────────
    data class PointsBreakdown(
        val playingXi: Int,
        val batting: Int,
        val bowling: Int,
        val fielding: Int,
        val total: Int
    )

    fun breakdown(p: PlayerMatchPerformance): PointsBreakdown {
        var playingXiPts = 0
        var battingPts   = 0
        var bowlingPts   = 0
        var fieldingPts  = 0

        if (p.playingXi) playingXiPts += 4

        // Batting
        battingPts += p.runs
        battingPts += p.fours
        battingPts += p.sixes * 2
        if (p.runs >= 100) battingPts += 16
        else if (p.runs >= 50) battingPts += 8
        if (p.runs == 0 && p.dismissed) battingPts -= 2
        if (p.ballsFaced >= 10) {
            val sr = (p.runs.toDouble() / p.ballsFaced) * 100
            battingPts += when {
                sr > 170  ->  6
                sr >= 150 ->  4
                sr >= 130 ->  2
                sr in 50.0..60.0  -> -4
                sr in 60.0..70.0  -> -2
                sr < 50   -> -6
                else      ->  0
            }
        }

        // Bowling
        bowlingPts += p.wickets * 25
        bowlingPts += p.lbwBowledCount * 8
        bowlingPts += p.maidens * 4
        bowlingPts += when {
            p.wickets >= 5 -> 16
            p.wickets >= 4 ->  8
            p.wickets >= 3 ->  4
            else           ->  0
        }
        val oversDouble = p.oversBowled.toDouble()
        if (oversDouble >= 2.0) {
            val economy = p.runsGiven.toDouble() / oversDouble
            bowlingPts += when {
                economy < 5  ->  6
                economy < 6  ->  4
                economy < 7  ->  2
                economy in 10.0..11.0 -> -2
                economy in 11.0..12.0 -> -4
                economy > 12 -> -6
                else         ->  0
            }
        }

        // Fielding
        fieldingPts += p.catches * 8
        if (p.catches >= 3) fieldingPts += 4
        fieldingPts += p.stumpings * 12
        fieldingPts += p.runOutsDirect * 12
        fieldingPts += p.runOutsIndirect * 6

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

    // Test 1 — Rohit 50-run innings (50 runs, 30 balls, 4 fours, 2 sixes)
    val rohit = PlayerMatchPerformance(
        id = "1", playerId = "p1", matchId = "m1",
        runs = 50, ballsFaced = 30, fours = 4, sixes = 2,
        dismissed = false, wickets = 0, lbwBowledCount = 0,
        oversBowled = java.math.BigDecimal.ZERO, runsGiven = 0, maidens = 0,
        catches = 0, stumpings = 0, runOutsDirect = 0, runOutsIndirect = 0,
        playingXi = true, fantasyPoints = 0, createdAt = 0L
    )
    println("Rohit 50: ${calculator.calculate(rohit)} pts (expected 76)")
    println(calculator.breakdown(rohit))

    // Test 2 — 5 wicket haul (5 wkts, 2 lbw/bowled, 4 overs, 20 runs)
    val bumrah = PlayerMatchPerformance(
        id = "2", playerId = "p2", matchId = "m1",
        runs = 0, ballsFaced = 0, fours = 0, sixes = 0,
        dismissed = false, wickets = 5, lbwBowledCount = 2,
        oversBowled = java.math.BigDecimal("4.0"), runsGiven = 20, maidens = 1,
        catches = 0, stumpings = 0, runOutsDirect = 0, runOutsIndirect = 0,
        playingXi = true, fantasyPoints = 0, createdAt = 0L
    )
    println("Bumrah 5-fer: ${calculator.calculate(bumrah)} pts (expected 169)")
    println(calculator.breakdown(bumrah))

    // Test 3 — duck
    val duck = PlayerMatchPerformance(
        id = "3", playerId = "p3", matchId = "m1",
        runs = 0, ballsFaced = 3, fours = 0, sixes = 0,
        dismissed = true, wickets = 0, lbwBowledCount = 0,
        oversBowled = java.math.BigDecimal.ZERO, runsGiven = 0, maidens = 0,
        catches = 0, stumpings = 0, runOutsDirect = 0, runOutsIndirect = 0,
        playingXi = true, fantasyPoints = 0, createdAt = 0L
    )
    println("Duck: ${calculator.calculate(duck)} pts (expected 2)")
    println(calculator.breakdown(duck))
}