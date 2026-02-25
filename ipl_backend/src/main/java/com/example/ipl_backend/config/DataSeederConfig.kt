package com.example.ipl_backend.config


import com.example.ipl_backend.service.PlayerCsvSeederService
import org.springframework.boot.CommandLineRunner
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class DataSeederConfig {

    @Bean
    fun seedPlayers(seeder: PlayerCsvSeederService) = CommandLineRunner {
        seeder.seed()
    }
}