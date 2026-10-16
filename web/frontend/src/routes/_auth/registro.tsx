import { createFileRoute } from "@tanstack/react-router"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SignupForm } from "@/features/auth/SignupForm"

export const Route = createFileRoute("/_auth/registro")({
  component: SignupPage,
})

function SignupPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Crear cuenta</CardTitle>
        <CardDescription>
          Solo necesitas email, contraseña y alias. El resto es opcional.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SignupForm />
      </CardContent>
    </Card>
  )
}
