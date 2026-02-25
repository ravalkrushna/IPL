/* eslint-disable @typescript-eslint/no-explicit-any */
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

export function AuthCard({ title, children }: any) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="w-100">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  )
}