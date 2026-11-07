import { Suspense } from "react";

import { proveedoresDisponibles } from "@/libs/auth/providers/auth-providers";
import { LoginForm } from "./_components/login-form";

// Server component: decides from the environment which sign-in methods exist and hands them to the form.
// The form reads the `error` query parameter with useSearchParams, which Next 15 requires inside <Suspense>.
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm proveedores={proveedoresDisponibles()} />
    </Suspense>
  );
}
