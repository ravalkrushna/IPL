import { z } from "zod"

export const signupSchema = z.object({
  name: z.string().min(2, "Name too short"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Minimum 6 characters"),
})

export type SignupFormData = z.infer<typeof signupSchema>

export const otpSchema = z.object({
  email: z.string().email(),
  otp: z.string().min(4, "Invalid OTP"),
})

export type OtpFormData = z.infer<typeof otpSchema>

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export type LoginFormData = z.infer<typeof loginSchema>