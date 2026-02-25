/* eslint-disable react-refresh/only-export-components */
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"

import { loginSchema, LoginFormData } from "@/schema/auth.schema"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Form } from "@/components/ui/form"

import { FormFieldInput } from "@/components/shared/FormFieldInput"
import { login } from "@/lib/auth"

export const Route = createFileRoute("/auth/login")({
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: () => navigate({ to: "/auction" }),
  })

  return (
    <div className="min-h-screen grid place-items-center 
                    bg-linear-to-br from-indigo-950 via-slate-950 to-purple-950">

      <Card className="w-full max-w-sm bg-background/80 backdrop-blur-xl
                       border-white/10 shadow-2xl">

        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight">
            🏏 Welcome to IPL Auction Game
          </CardTitle>

          <p className="text-sm text-muted-foreground">
            Build your championship squad
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
                {mutation.isPending ? "Signing in..." : "Enter Into Game"}
              </Button>
            </form>
          </Form>

          <div className="mt-4 text-center text-sm">
            <span className="text-muted-foreground">
              New player?
            </span>{" "}
            <button
              onClick={() => navigate({ to: "/auth/signup" })}
              className="text-purple-400 hover:text-purple-300 transition"
            >
              Join League
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}