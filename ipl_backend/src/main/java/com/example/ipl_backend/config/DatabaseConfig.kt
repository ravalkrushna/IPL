package com.example.ipl_backend.config

import jakarta.annotation.PostConstruct
import org.jetbrains.exposed.sql.Database
import org.springframework.context.annotation.Configuration
import javax.sql.DataSource

@Configuration
class DatabaseConfig(
    private val dataSource: DataSource
) {

    @PostConstruct
    fun connect() {
        Database.connect(dataSource)
    }
}