package com.example.ipl_backend.exception

class UserAlreadyExistsException() : RuntimeException("User with the provided email already exists. Please use a different email address.") {
}