/* eslint-disable react-refresh/only-export-components */
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { z } from "zod"

import { otpSchema, OtpFormData } from "@/schema/auth.schema"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Form } from "@/components/ui/form"

import { FormFieldInput } from "@/components/shared/FormFieldInput"
import { verifyOtp } from "@/lib/auth"

const searchSchema = z.object({
  email: z.string().email(),
})

export const Route = createFileRoute("/auth/verify-otp")({
  validateSearch: searchSchema,
  component: VerifyOtpPage,
})

function VerifyOtpPage() {
  const navigate = useNavigate()
  const { email } = Route.useSearch()

  const form = useForm<OtpFormData>({
    resolver: zodResolver(otpSchema),
    defaultValues: { email, otp: "" },
  })

  const mutation = useMutation({
    mutationFn: verifyOtp,
    onSuccess: () => navigate({ to: "/auth/login" }),
  })

  return (
    <div className="min-h-screen grid place-items-center
                    bg-linear-to-br from-indigo-950 via-slate-950 to-purple-950">

      <Card className="w-full max-w-sm bg-background/80 backdrop-blur-xl
                       border-white/10 shadow-2xl">

        <CardHeader>
          <CardTitle className="text-2xl font-bold">
            🔐 Verify Entry
          </CardTitle>

          <p className="text-sm text-muted-foreground">
            OTP sent to <span className="text-purple-400">{email}</span>
          </p>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((d) => mutation.mutate(d))}
              className="space-y-4"
            >
              <FormFieldInput
                control={form.control}
                name="otp"
                label="Auction Passcode"
              />

              <Button
                className="w-full font-semibold tracking-wide
                           bg-linear-to-r from-purple-600 to-pink-600
                           hover:from-purple-500 hover:to-pink-500"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? "Verifying..." : "Enter League"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}