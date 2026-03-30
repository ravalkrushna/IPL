package com.example.ipl_backend.service

import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport
import com.google.api.client.json.gson.GsonFactory
import com.google.api.services.sheets.v4.Sheets
import com.google.api.services.sheets.v4.SheetsScopes
import com.google.api.services.sheets.v4.model.AddSheetRequest
import com.google.api.services.sheets.v4.model.BatchUpdateSpreadsheetRequest
import com.google.api.services.sheets.v4.model.ClearValuesRequest
import com.google.api.services.sheets.v4.model.Request
import com.google.api.services.sheets.v4.model.SheetProperties
import com.google.api.services.sheets.v4.model.ValueRange
import com.google.auth.http.HttpCredentialsAdapter
import com.google.auth.oauth2.GoogleCredentials
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import java.io.InputStream

@Service
class GoogleSheetsService(
    @Value("\${google.sheets.spreadsheet-id:16OyIDPm7YIswfEgnjtK6UgiP5ZzK42PPgQWbM-4-R_I}")
    private val spreadsheetId: String
) {

    private val log = LoggerFactory.getLogger(javaClass)

    companion object {
        const val TAB_NAME = "Fantasy Points"
        const val APP_NAME = "BidXI"
    }

    private val sheets: Sheets by lazy { buildSheetsClient() }

    private fun buildSheetsClient(): Sheets {
        val credStream: InputStream =
            javaClass.classLoader.getResourceAsStream("google-credentials.json")
                ?: error("google-credentials.json not found in classpath (src/main/resources)")

        val credentials = GoogleCredentials
            .fromStream(credStream)
            .createScoped(listOf(SheetsScopes.SPREADSHEETS))

        return Sheets.Builder(
            GoogleNetHttpTransport.newTrustedTransport(),
            GsonFactory.getDefaultInstance(),
            HttpCredentialsAdapter(credentials)
        ).setApplicationName(APP_NAME).build()
    }

    /** A1 range: sheet names with spaces/special chars must be wrapped in single quotes. */
    private fun a1(tabName: String, cellRange: String): String {
        val escaped = tabName.replace("'", "''")
        return "'$escaped'!$cellRange"
    }

    fun ensureTabExists(tabName: String) {
        val spreadsheet = sheets.spreadsheets().get(spreadsheetId).execute()
        val exists = spreadsheet.sheets?.any { sheet ->
            sheet.properties?.title == tabName
        } ?: false

        if (!exists) {
            val addSheetRequest = AddSheetRequest()
                .setProperties(SheetProperties().setTitle(tabName))
            val batchRequest = BatchUpdateSpreadsheetRequest()
                .setRequests(listOf(Request().setAddSheet(addSheetRequest)))
            sheets.spreadsheets().batchUpdate(spreadsheetId, batchRequest).execute()
            log.info("Created tab '$tabName' in spreadsheet …${spreadsheetId.takeLast(6)}")
        }
    }

    fun readAll(): List<List<Any>> {
        val response = sheets.spreadsheets().values()
            .get(spreadsheetId, a1(TAB_NAME, "A1:ZZ999"))
            .execute()
        return response.getValues() ?: emptyList()
    }

    fun writeAll(rows: List<List<Any>>) {
        writeToTab(TAB_NAME, rows)
    }

    fun writeToTab(tabName: String, rows: List<List<Any>>) {
        ensureTabExists(tabName)
        clearTab(tabName)
        val body = ValueRange().setValues(rows)
        val range = a1(tabName, "A1")
        sheets.spreadsheets().values()
            .update(spreadsheetId, range, body)
            .setValueInputOption("USER_ENTERED")
            .execute()
        log.info("Wrote {} rows to tab '{}' (spreadsheet …{})", rows.size, tabName, spreadsheetId.takeLast(8))
    }

    fun updateCell(row: Int, col: Int, value: Any) {
        val range = a1(TAB_NAME, "${colLetter(col)}$row")
        val body = ValueRange().setValues(listOf(listOf(value)))
        sheets.spreadsheets().values()
            .update(spreadsheetId, range, body)
            .setValueInputOption("RAW")
            .execute()
    }

    fun appendColumn(headerRow: Int, colIndex: Int, header: String) {
        updateCell(headerRow, colIndex, header)
    }

    fun clearTab(tabName: String) {
        sheets.spreadsheets().values()
            .clear(spreadsheetId, a1(tabName, "A1:ZZ"), ClearValuesRequest())
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
