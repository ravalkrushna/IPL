package com.example.ipl_backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class IplBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(IplBackendApplication.class, args);
    }

}
