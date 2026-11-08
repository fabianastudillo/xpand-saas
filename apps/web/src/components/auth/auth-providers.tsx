import { signIn } from "next-auth/react";

import type { ProveedoresDisponibles } from "@/libs/auth/providers/auth-providers";
import { Button } from "../ui/button";

const OAUTH_PROVIDERS = [
  {
    name: "Google",
    id: "google",
    disponible: (proveedores: ProveedoresDisponibles) => proveedores.google,
  },
];

interface AuthProvidersProps {
  proveedores: ProveedoresDisponibles;
}

/** OAuth buttons for the providers the server has configured; none when there is none. */
export const AuthProviders = ({ proveedores }: AuthProvidersProps) => {
  const providers = OAUTH_PROVIDERS.filter((provider) =>
    provider.disponible(proveedores),
  );

  return (
    <>
      {providers.map((provider) => {
        return (
          <div key={provider.name} className="mr-2">
            <Button
              variant="secondary"
              className="btn w-full"
              onClick={() => signIn(provider.id)}
            >
              Sign in with {provider.name}
            </Button>
          </div>
        );
      })}
    </>
  );
};
