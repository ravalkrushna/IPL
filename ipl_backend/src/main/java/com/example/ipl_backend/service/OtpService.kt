package com.example.ipl_backend.service

import com.example.ipl_backend.exception.InvalidOtpException
import com.example.ipl_backend.model.Otps
import com.example.ipl_backend.repository.OtpRepository
import org.springframework.stereotype.Service
import java.time.Instant
import kotlin.random.Random

@Service
class OtpService(
    private val otpRepository: OtpRepository,
    private val emailService: EmailService
) {

    fun generateOtp(email: String) {

        val otp = Random.nextInt(100000, 999999).toString()

        /* ✅ Proper expiry (IMPORTANT FIX) */
        val expiry = Instant.now().toEpochMilli() + (5 * 60 * 1000) // 5 mins

        otpRepository.save(email, otp, expiry)

        println("OTP for $email = $otp")

        emailService.sendOtp(email, otp)
    }

    fun validateOtp(email: String, otp: String) {

        val row = otpRepository.findValidOtp(email)
            ?: throw InvalidOtpException()

        val storedOtp = row[Otps.code]   // 🔥 CRITICAL FIX

        if (storedOtp != otp) {
            throw InvalidOtpException()
        }

        otpRepository.delete(email)
    }
}