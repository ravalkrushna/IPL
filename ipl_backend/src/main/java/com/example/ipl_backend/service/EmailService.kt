package com.example.ipl_backend.service

import org.springframework.mail.SimpleMailMessage
import org.springframework.mail.javamail.JavaMailSender
import org.springframework.stereotype.Service

@Service
class EmailService(
    private val mailSender: JavaMailSender
) {

    fun sendOtp(email: String, otp: String) {

        val message = SimpleMailMessage()
        message.setTo(email)
        message.subject = "Your OTP Code"
        message.text = """
            Your OTP is: $otp
            
            This OTP will expire shortly.
            
            Ignore if you did not request this.
        """.trimIndent()

        try {
            mailSender.send(message)
            println("✅ OTP EMAIL SENT")
        } catch (ex: Exception) {
            ex.printStackTrace()   // 🔥 Never swallow mail errors
        }
    }
}