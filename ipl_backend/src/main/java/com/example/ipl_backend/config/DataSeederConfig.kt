package com.example.ipl_backend.config

import com.example.ipl_backend.service.IplPlayerScraperService
import org.springframework.boot.CommandLineRunner
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class DataSeederConfig {

    @Bean
    fun seedPlayers(scraper: IplPlayerScraperService) = CommandLineRunner {
        scraper.seed()
    }
}