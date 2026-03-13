package com.example.ipl_backend.controller

import com.example.ipl_backend.model.Player
import com.example.ipl_backend.repository.PlayerRepository
import org.apache.poi.ss.usermodel.CellType
import org.apache.poi.ss.usermodel.WorkbookFactory
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import org.springframework.web.multipart.MultipartFile
import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

data class CsvUploadResult(
    val inserted: Int,
    val updated: Int,
    val skipped: Int,
    val errors: List<String>
)

data class PlayerRow(
    val name: String?,
    val specialism: String?,
    val iplTeam: String?,
    val country: String?,
    val age: String?,
    val battingStyle: String?,
    val bowlingStyle: String?,
    val testCaps: String?,
    val odiCaps: String?,
    val t20Caps: String?,
)

// Known name-column aliases — used to detect the header row
private val NAME_ALIASES = setOf("name", "player name", "playername", "player_name")

private val FIXED_BASE_PRICE = BigDecimal("5000000") // ₹50 Lakhs always

@RestController
@RequestMapping("/api/v1/admin/players")
class PlayerCsvUploadController(
    private val playerRepository: PlayerRepository
) {

    @PostMapping("/upload-csv")
    fun uploadFile(@RequestParam("file") file: MultipartFile): ResponseEntity<CsvUploadResult> {
        if (file.isEmpty) {
            return ResponseEntity.badRequest().body(
                CsvUploadResult(0, 0, 0, listOf("Uploaded file is empty"))
            )
        }

        val filename = file.originalFilename?.lowercase() ?: ""
        val parseErrors = mutableListOf<String>()

        val rows: List<PlayerRow> = try {
            when {
                filename.endsWith(".xlsx") || filename.endsWith(".xls") ->
                    parseExcel(file, parseErrors)
                filename.endsWith(".csv") ->
                    parseCsv(file, parseErrors)
                else -> return ResponseEntity.badRequest().body(
                    CsvUploadResult(0, 0, 0, listOf("Unsupported file type. Please upload a .csv or .xlsx file."))
                )
            }
        } catch (e: Exception) {
            return ResponseEntity.badRequest().body(
                CsvUploadResult(0, 0, 0, listOf("Failed to parse file: ${e.message}"))
            )
        }

        return ResponseEntity.ok(processRows(rows, parseErrors))
    }

    // ── CSV ───────────────────────────────────────────────────────────────────

    private fun parseCsv(file: MultipartFile, errors: MutableList<String>): List<PlayerRow> {
        val lines = file.inputStream.bufferedReader().readLines()
            .map { it.trim() }
            .filter { it.isNotBlank() }
        if (lines.isEmpty()) return emptyList()

        val headerLineIndex = lines.indexOfFirst { line ->
            line.split(",").map { it.trim().lowercase() }.any { it in NAME_ALIASES }
        }

        if (headerLineIndex == -1) {
            errors.add("CSV must have a 'name' or 'player name' column")
            return emptyList()
        }

        val header = lines[headerLineIndex].split(",").map { it.trim().lowercase() }

        fun idx(vararg names: String) =
            names.firstNotNullOfOrNull { n -> header.indexOfFirst { it == n }.takeIf { it >= 0 } } ?: -1

        val nameIdx       = idx("name", "player name", "playername", "player_name")
        val specialismIdx = idx("specialism", "role")
        val iplTeamIdx    = idx("iplteam", "ipl_team", "team")
        val countryIdx    = idx("country")
        val ageIdx        = idx("age")
        val battingIdx    = idx("battingstyle", "batting_style", "batting")
        val bowlingIdx    = idx("bowlingstyle", "bowling_style", "bowling")
        val testCapsIdx   = idx("testcaps", "test_caps", "test")
        val odiCapsIdx    = idx("odicaps", "odi_caps", "odi")
        val t20CapsIdx    = idx("t20caps", "t20_caps", "t20")

        return lines.drop(headerLineIndex + 1).mapNotNull { line ->
            if (line.isBlank()) return@mapNotNull null
            val cols = line.split(",").map { it.trim() }
            fun col(i: Int) = if (i >= 0 && i < cols.size) cols[i].ifBlank { null } else null
            PlayerRow(
                name         = col(nameIdx),
                specialism   = col(specialismIdx),
                iplTeam      = col(iplTeamIdx),
                country      = col(countryIdx),
                age          = col(ageIdx),
                battingStyle = col(battingIdx),
                bowlingStyle = col(bowlingIdx),
                testCaps     = col(testCapsIdx),
                odiCaps      = col(odiCapsIdx),
                t20Caps      = col(t20CapsIdx),
            )
        }
    }

    // ── Excel ─────────────────────────────────────────────────────────────────

    private fun parseExcel(file: MultipartFile, errors: MutableList<String>): List<PlayerRow> {
        val workbook = WorkbookFactory.create(file.inputStream)
        val sheet = workbook.getSheetAt(0)
        val allRows = sheet.toList()
        if (allRows.isEmpty()) return emptyList()

        val headerRowIndex = allRows.indexOfFirst { row ->
            row.any { cell -> cell.toString().trim().lowercase() in NAME_ALIASES }
        }

        if (headerRowIndex == -1) {
            errors.add("Could not find a header row with a 'name' or 'player name' column")
            return emptyList()
        }

        val headerRow = allRows[headerRowIndex]
        val headerMap = mutableMapOf<String, Int>()
        for (cell in headerRow) {
            headerMap[cell.toString().trim().lowercase()] = cell.columnIndex
        }

        fun idx(vararg names: String) = names.firstNotNullOfOrNull { headerMap[it] } ?: -1

        val nameIdx       = idx("name", "player name", "playername", "player_name")
        val specialismIdx = idx("specialism", "role")
        val iplTeamIdx    = idx("iplteam", "ipl_team", "team")
        val countryIdx    = idx("country")
        val ageIdx        = idx("age")
        val battingIdx    = idx("battingstyle", "batting_style", "batting")
        val bowlingIdx    = idx("bowlingstyle", "bowling_style", "bowling")
        val testCapsIdx   = idx("testcaps", "test_caps", "test")
        val odiCapsIdx    = idx("odicaps", "odi_caps", "odi")
        val t20CapsIdx    = idx("t20caps", "t20_caps", "t20")

        fun cellStr(row: org.apache.poi.ss.usermodel.Row?, colIdx: Int): String? {
            if (colIdx == -1 || row == null) return null
            val cell = row.getCell(colIdx) ?: return null
            return when (cell.cellType) {
                CellType.NUMERIC -> {
                    val d = cell.numericCellValue
                    if (d == kotlin.math.floor(d)) d.toLong().toString() else d.toString()
                }
                CellType.STRING  -> cell.stringCellValue.trim().ifBlank { null }
                CellType.BOOLEAN -> cell.booleanCellValue.toString()
                CellType.FORMULA -> runCatching { cell.toString().trim().ifBlank { null } }.getOrNull()
                else             -> null
            }
        }

        return allRows.drop(headerRowIndex + 1).mapNotNull { row ->
            val name = cellStr(row, nameIdx) ?: return@mapNotNull null
            PlayerRow(
                name         = name,
                specialism   = cellStr(row, specialismIdx),
                iplTeam      = cellStr(row, iplTeamIdx),
                country      = cellStr(row, countryIdx),
                age          = cellStr(row, ageIdx),
                battingStyle = cellStr(row, battingIdx),
                bowlingStyle = cellStr(row, bowlingIdx),
                testCaps     = cellStr(row, testCapsIdx),
                odiCaps      = cellStr(row, odiCapsIdx),
                t20Caps      = cellStr(row, t20CapsIdx),
            )
        }
    }

    // ── Upsert ────────────────────────────────────────────────────────────────

    private fun processRows(rows: List<PlayerRow>, existingErrors: MutableList<String>): CsvUploadResult {
        var inserted = 0
        var updated  = 0
        var skipped  = 0
        val errors   = existingErrors
        val now      = Instant.now().toEpochMilli()

        rows.forEachIndexed { index, row ->
            val rowNum = index + 2
            val name = row.name?.trim() ?: run {
                errors.add("Row $rowNum: missing name, skipped")
                skipped++
                return@forEachIndexed
            }

            val age      = row.age?.toIntOrNull()
            val testCaps = row.testCaps?.toIntOrNull() ?: 0
            val odiCaps  = row.odiCaps?.toIntOrNull()  ?: 0
            val t20Caps  = row.t20Caps?.toIntOrNull()  ?: 0

            val existing = playerRepository.findByName(name)
            if (existing != null) {
                playerRepository.update(
                    existing.copy(
                        country      = row.country      ?: existing.country,
                        age          = age              ?: existing.age,
                        specialism   = row.specialism?.uppercase() ?: existing.specialism,
                        battingStyle = row.battingStyle ?: existing.battingStyle,
                        bowlingStyle = row.bowlingStyle ?: existing.bowlingStyle,
                        testCaps     = testCaps,
                        odiCaps      = odiCaps,
                        t20Caps      = t20Caps,
                        basePrice    = FIXED_BASE_PRICE,
                        iplTeam      = row.iplTeam      ?: existing.iplTeam,
                        updatedAt    = now
                    )
                )
                updated++
            } else {
                playerRepository.save(
                    Player(
                        id           = UUID.randomUUID().toString(),
                        name         = name,
                        country      = row.country,
                        age          = age,
                        specialism   = row.specialism?.uppercase(),
                        battingStyle = row.battingStyle,
                        bowlingStyle = row.bowlingStyle,
                        testCaps     = testCaps,
                        odiCaps      = odiCaps,
                        t20Caps      = t20Caps,
                        basePrice    = FIXED_BASE_PRICE,
                        iplTeam      = row.iplTeam,
                        isSold       = false,
                        isAuctioned  = false,
                        createdAt    = now,
                        updatedAt    = now
                    )
                )
                inserted++
            }
        }

        return CsvUploadResult(inserted, updated, skipped, errors)
    }
}