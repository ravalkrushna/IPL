package com.example.ipl_backend.service

import com.example.ipl_backend.dto.*
import com.example.ipl_backend.exception.*
import com.example.ipl_backend.model.Role
import org.springframework.security.web.context.HttpSessionSecurityContextRepository
import com.example.ipl_backend.repository.ParticipantRepository
import com.example.ipl_backend.repository.UserRepository
import jakarta.servlet.http.HttpServletRequest
import org.jetbrains.exposed.sql.transactions.transaction
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import java.util.UUID

@Service
class AuthService(
    private val userRepository: UserRepository,
    private val participantService: ParticipantService,
    private val participantRepository: ParticipantRepository,
    private val otpService: OtpService,
    private val passwordEncoder: PasswordEncoder
) {

    fun signup(request: SignupRequest): String = transaction {

        if (userRepository.existsByEmail(request.email)) {
            throw UserAlreadyExistsException()
        }

        val userId: UUID = userRepository.create(
            name = request.name,
            email = request.email,
            password = passwordEncoder.encode(request.password).toString(), // ✅ cleaner
            role = Role.PARTICIPANT
        )

        participantService.create(
            name = request.name,
            userId = userId
        )

        otpService.generateOtp(request.email)   // 🔥 Will send mail now

        "OTP sent"
    }

    fun verifyOtp(request: VerifyOtpRequest): String = transaction {

        otpService.validateOtp(request.email, request.otp)
        userRepository.markVerified(request.email)

        "Verified"
    }

    fun login(request: LoginRequest, servletRequest: HttpServletRequest): String {

        val session = servletRequest.getSession(true)   // 🚀 MOVE TO TOP

        val user = transaction {
            userRepository.findByEmail(request.email)
                ?: throw InvalidCredentialsException()
        }

        if (!passwordEncoder.matches(request.password, user.password)) {
            throw InvalidCredentialsException()
        }

        if (!user.isVerified) {
            throw AccountNotVerifiedException()
        }

        val authentication = UsernamePasswordAuthenticationToken(
            user.email,
            null,
            listOf(SimpleGrantedAuthority("ROLE_${user.role.name}"))
        )

        val context = SecurityContextHolder.createEmptyContext()
        context.authentication = authentication

        SecurityContextHolder.setContext(context)

        session.setAttribute(
            HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY,
            context
        )

        return "Login success"
    }

    fun me(email: String): UserResponse = transaction {

        val user = userRepository.findByEmail(email)
            ?: throw RuntimeException("User not found")

        val participant = participantRepository.findByUserId(user.id)
            ?: throw RuntimeException("Participant not found")

        UserResponse(
            id = user.id,
            name = user.name,
            email = user.email,
            role = user.role,
            participantId = participant.id
        )
    }
}