package com.example.ipl_backend.service

import com.example.ipl_backend.dto.*
import com.example.ipl_backend.exception.*
import com.example.ipl_backend.model.Role
import org.springframework.security.web.context.HttpSessionSecurityContextRepository
import com.example.ipl_backend.repository.AuctionRepository
import com.example.ipl_backend.repository.ParticipantRepository
import com.example.ipl_backend.repository.UserRepository
import com.example.ipl_backend.repository.WalletRepository
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
    private val passwordEncoder: PasswordEncoder,
    private val walletRepository: WalletRepository,
    private val auctionRepository: AuctionRepository
) {

    fun signup(request: SignupRequest): String = transaction {

        if (userRepository.existsByEmail(request.email)) {
            throw UserAlreadyExistsException()
        }

        val userId: UUID = userRepository.create(
            name     = request.name,
            email    = request.email,
            password = passwordEncoder.encode(request.password).toString(),
            role     = Role.PARTICIPANT
        )

        val participant = participantService.create(
            name   = request.name,
            userId = userId
        )

        // Give new participant 100CR wallet for every currently active auction
        val activeAuctionIds = auctionRepository.findAllActiveIds()
        if (activeAuctionIds.isNotEmpty()) {
            walletRepository.createForParticipantInAllActiveAuctions(
                participantId    = participant.id,
                activeAuctionIds = activeAuctionIds
            )
            println("💰 New participant ${participant.name} got 100CR wallets for ${activeAuctionIds.size} active auctions")
        }

        otpService.generateOtp(request.email)
        "OTP sent"
    }

    fun verifyOtp(request: VerifyOtpRequest): String = transaction {
        otpService.validateOtp(request.email, request.otp)
        userRepository.markVerified(request.email)
        "Verified"
    }

    fun login(request: LoginRequest, servletRequest: HttpServletRequest): String {

        val session = servletRequest.getSession(true)

        val user = transaction {
            userRepository.findByEmail(request.email)
                ?: throw InvalidCredentialsException()
        }

        if (!passwordEncoder.matches(request.password, user.password))
            throw InvalidCredentialsException()

        if (!user.isVerified)
            throw AccountNotVerifiedException()

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
            id            = user.id,
            name          = user.name,
            email         = user.email,
            role          = user.role,
            participantId = participant.id
        )
    }
}