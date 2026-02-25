package com.example.ipl_backend.controller

import com.example.ipl_backend.model.Participant
import com.example.ipl_backend.service.ParticipantService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import java.util.UUID

@RestController
@RequestMapping("/api/v1/participants")
class ParticipantController(
    private val participantService: ParticipantService
) {

    @GetMapping("/get/{id}")
    fun getById(@PathVariable id: UUID): ResponseEntity<Participant> {

        return ResponseEntity.ok(
            participantService.getById(id)
        )
    }

    @GetMapping("/list")
    fun list(): ResponseEntity<List<Participant>> {

        return ResponseEntity.ok(
            participantService.list()
        )
    }
}