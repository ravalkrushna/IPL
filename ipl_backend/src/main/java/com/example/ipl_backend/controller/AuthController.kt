package com.example.ipl_backend.controller

import com.example.ipl_backend.dto.*
import com.example.ipl_backend.service.AuthService
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1/auth")
class AuthController(
    private val authService: AuthService
) {

    @PostMapping("/signup")
    fun signup(@RequestBody request: SignupRequest) =
        ResponseEntity.ok(authService.signup(request))

    @PostMapping("/verify-otp")
    fun verify(@RequestBody request: VerifyOtpRequest) =
        ResponseEntity.ok(authService.verifyOtp(request))

    @PostMapping("/login")
    fun login(
        @RequestBody request: LoginRequest,
        servletRequest: HttpServletRequest    // 🚀 ADD THIS
    ) =
        ResponseEntity.ok(authService.login(request, servletRequest))

    @GetMapping("/debug-auth")
    fun debugAuth(): ResponseEntity<Any> {
        val auth = SecurityContextHolder.getContext().authentication

        return ResponseEntity.ok(
            mapOf(
                "principal" to auth?.principal,
                "authenticated" to auth?.isAuthenticated,
                "authorities" to auth?.authorities
            )
        )
    }

    @PostMapping("/logout")
    fun logout(request: HttpServletRequest): ResponseEntity<Any> {

        request.logout()          // Spring Security cleanup
        request.session.invalidate()

        return ResponseEntity.ok(mapOf("message" to "Logged out"))
    }

    @GetMapping("/me")
    fun me(authentication: Authentication?): ResponseEntity<UserResponse> {
        if (authentication == null || !authentication.isAuthenticated) {
            return ResponseEntity.status(401).build()
        }
        val email = authentication.name
        return ResponseEntity.ok(authService.me(email))
    }
}