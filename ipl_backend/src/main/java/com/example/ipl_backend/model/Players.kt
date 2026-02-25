package com.example.ipl_backend.model

import java.math.BigDecimal
import org.jetbrains.exposed.sql.Table

object Players : Table("players") {

    val id = varchar("id", 255)
    val name = varchar("name", 255)
    val country = varchar("country", 255).nullable()
    val age = integer("age").nullable()
    val specialism = varchar("specialism", 100).nullable()
    val battingStyle = varchar("batting_style", 255).nullable()
    val bowlingStyle = varchar("bowling_style", 255).nullable()

    val testCaps = integer("test_caps").default(0)
    val odiCaps = integer("odi_caps").default(0)
    val t20Caps = integer("t20_caps").default(0)

    val basePrice = decimal("base_price", 15, 2)

    val isSold = bool("is_sold").default(false)

    val isAuctioned = bool("is_auctioned").default(false)

    val createdAt = long("created_at")
    val updatedAt = long("updated_at")

    override val primaryKey = PrimaryKey(id)
}


data class Player(
    val id: String,
    val name: String,
    val country: String?,
    val age: Int?,
    val specialism: String?,
    val battingStyle: String?,
    val bowlingStyle: String?,
    val testCaps: Int,
    val odiCaps: Int,
    val t20Caps: Int,
    val basePrice: BigDecimal,
    val isSold: Boolean,
    val isAuctioned: Boolean = false,   // default so existing call sites don't break
    val createdAt: Long,
    val updatedAt: Long
)