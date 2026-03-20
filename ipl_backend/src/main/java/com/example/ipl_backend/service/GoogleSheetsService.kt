package com.example.ipl_backend.service

import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport
import com.google.api.client.json.gson.GsonFactory
import com.google.api.services.sheets.v4.Sheets
import com.google.api.services.sheets.v4.SheetsScopes
import com.google.api.services.sheets.v4.model.AddSheetRequest
import com.google.api.services.sheets.v4.model.BatchUpdateSpreadsheetRequest
import com.google.api.services.sheets.v4.model.Request
import com.google.api.services.sheets.v4.model.SheetProperties
import com.google.api.services.sheets.v4.model.ValueRange
import com.google.auth.http.HttpCredentialsAdapter
import com.google.auth.oauth2.GoogleCredentials
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import java.io.InputStream

@Service
class GoogleSheetsService {

    private val log = LoggerFactory.getLogger(javaClass)

    companion object {
        const val SHEET_ID = "16OyIDPm7YIswfEgnjtK6UgiP5ZzK42PPgQWbM-4-R_I"
        const val TAB_NAME = "Fantasy Points"
        const val APP_NAME = "BidXI"
    }

    private val sheets: Sheets by lazy { buildSheetsClient() }

    private fun buildSheetsClient(): Sheets {
        val credStream: InputStream =
            javaClass.classLoader.getResourceAsStream("google-credentials.json")
                ?: error("google-credentials.json not found in resources")

        val credentials = GoogleCredentials
            .fromStream(credStream)
            .createScoped(listOf(SheetsScopes.SPREADSHEETS))

        return Sheets.Builder(
            GoogleNetHttpTransport.newTrustedTransport(),
            GsonFactory.getDefaultInstance(),
            HttpCredentialsAdapter(credentials)
        ).setApplicationName(APP_NAME).build()
    }

    // ── Ensure a tab exists, creating it if not ───────────────────────────────

    fun ensureTabExists(tabName: String) {
        val spreadsheet = sheets.spreadsheets().get(SHEET_ID).execute()
        val exists = spreadsheet.sheets?.any { sheet ->
            sheet.properties?.title == tabName
        } ?: false

        if (!exists) {
            val addSheetRequest = AddSheetRequest()
                .setProperties(SheetProperties().setTitle(tabName))
            val batchRequest = BatchUpdateSpreadsheetRequest()
                .setRequests(listOf(Request().setAddSheet(addSheetRequest)))
            sheets.spreadsheets().batchUpdate(SHEET_ID, batchRequest).execute()
            log.info("Created tab '$tabName'")
        }
    }

    // ── Read all rows from the sheet ──────────────────────────────────────────

    fun readAll(): List<List<Any>> {
        val response = sheets.spreadsheets().values()
            .get(SHEET_ID, TAB_NAME)
            .execute()
        return response.getValues() ?: emptyList()
    }

    // ── Write the entire "Fantasy Points" tab from scratch ───────────────────

    fun writeAll(rows: List<List<Any>>) {
        writeToTab(TAB_NAME, rows)
    }

    // ── Write any tab by name (ensures tab exists, then rewrites from A1) ────

    fun writeToTab(tabName: String, rows: List<List<Any>>) {
        ensureTabExists(tabName)
        clearTab(tabName)          // ← clear old data first
        val body = ValueRange().setValues(rows)
        sheets.spreadsheets().values()
            .update(SHEET_ID, "$tabName!A1", body)
            .setValueInputOption("USER_ENTERED")
            .execute()
    }

    // ── Update a single cell ──────────────────────────────────────────────────

    fun updateCell(row: Int, col: Int, value: Any) {
        val range = "${TAB_NAME}!${colLetter(col)}$row"
        val body = ValueRange().setValues(listOf(listOf(value)))
        sheets.spreadsheets().values()
            .update(SHEET_ID, range, body)
            .setValueInputOption("RAW")
            .execute()
    }

    // ── Append a new column header (new match) ────────────────────────────────

    fun appendColumn(headerRow: Int, colIndex: Int, header: String) {
        updateCell(headerRow, colIndex, header)
    }

    fun clearTab(tabName: String) {
        sheets.spreadsheets().values()
            .clear(SHEET_ID, "$tabName!A1:ZZ", com.google.api.services.sheets.v4.model.ClearValuesRequest())
            .execute()
    }

    private fun colLetter(col: Int): String {
        var n = col
        var result = ""
        while (n > 0) {
            val rem = (n - 1) % 26
            result = ('A' + rem) + result
            n = (n - 1) / 26
        }
        return result
    }
}