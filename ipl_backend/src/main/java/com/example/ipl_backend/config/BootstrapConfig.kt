package com.example.ipl_backend.config

import com.example.ipl_backend.repository.UserRepository
import com.example.ipl_backend.model.Role
import org.springframework.boot.ApplicationRunner
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.beans.factory.annotation.Value

@Configuration
class BootstrapConfig {
    @Bean
    fun bootstrapAdmin(
        userRepository: UserRepository,
        passwordEncoder: PasswordEncoder,
        @Value("\${app.bootstrap-admin-email}") email: String,
        @Value("\${app.bootstrap-admin-password}") password: String
    ) = ApplicationRunner {

        val existing = userRepository.findByEmail(email)

        when {

            existing == null -> {

                userRepository.createAdmin(
                    name = "Admin",
                    email = email,
                    password = passwordEncoder.encode(password).toString()
                )

                println("🔥 ADMIN CREATED: $email")
            }

            existing.role != Role.ADMIN -> {

                userRepository.promoteToAdmin(email)   // 🔥 MAGIC FIX

                println("🔥 USER PROMOTED TO ADMIN: $email")
            }

            else -> {
                println("✅ Admin already configured")
            }
        }
    }
}