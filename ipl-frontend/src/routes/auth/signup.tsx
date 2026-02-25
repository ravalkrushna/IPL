/* eslint-disable react-refresh/only-export-components */
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"

import { signupSchema, SignupFormData } from "@/schema/auth.schema"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Form } from "@/components/ui/form"

import { FormFieldInput } from "@/components/shared/FormFieldInput"
import { signup } from "@/lib/auth"

export const Route = createFileRoute("/auth/signup")({
  component: SignupPage,
})

function SignupPage() {
  const navigate = useNavigate()

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  })

  const mutation = useMutation({
    mutationFn: signup,
    onSuccess: (_, variables) =>
      navigate({
        to: "/auth/verify-otp",
        search: { email: variables.email },
      }),
  })

  return (
    <div className="min-h-screen grid place-items-center
                    bg-linear-to-br from-indigo-950 via-slate-950 to-purple-950">

      <Card className="w-full max-w-sm bg-background/80 backdrop-blur-xl
                       border-white/10 shadow-2xl">

        <CardHeader>
          <CardTitle className="text-2xl font-bold">
            🚀 Join IPL Auction Game
          </CardTitle>

          <p className="text-sm text-muted-foreground">
            Start playing like a cricket maestro
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
                name="name"
                label="Enter Your Player Name"
              />

              <FormFieldInput
                control={form.control}
                name="email"
                label="Email"
              />

              <FormFieldInput
                control={form.control}
                name="password"
                label="Password"
                type="password"
              />

              <Button
                className="w-full font-semibold tracking-wide
                           bg-linear-to-r from-purple-600 to-pink-600
                           hover:from-purple-500 hover:to-pink-500"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? "Creating Team..." : "Create Team"}
              </Button>
            </form>
          </Form>

          <div className="mt-4 text-center text-sm">
            <span className="text-muted-foreground">
              Already in the league?
            </span>{" "}
            <button
              onClick={() => navigate({ to: "/auth/login" })}
              className="text-purple-400 hover:text-purple-300 transition"
            >
              Enter Game
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}