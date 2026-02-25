package com.example.ipl_backend.controller

import jakarta.servlet.http.HttpServletRequest
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/test")
class SessionTestController {

    @GetMapping("/session")
    fun testSession(request: HttpServletRequest): String {

        val session = request.getSession(true)

        println("SESSION ID = ${session.id}")

        return "session created"
    }
}