import type { Provider } from "next-auth/providers";

import { getGoogleProvider } from "./google-provider";
import { getEmailProvider } from "./email-provider";

/** Which sign-in methods the environment configures. The login page offers only these. */
export interface ProveedoresDisponibles {
  /** Magic link by e-mail: needs EMAIL_SERVER. */
  email: boolean;
  /** Google OAuth: needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET. */
  google: boolean;
}

export const proveedoresDisponibles = (
  env: NodeJS.ProcessEnv = process.env,
): ProveedoresDisponibles => ({
  email: Boolean(env.EMAIL_SERVER),
  google: Boolean(env.GOOGLE_CLIENT_ID) && Boolean(env.GOOGLE_CLIENT_SECRET),
});

// A provider without its keys is not registered at all: the nodemailer provider throws at startup without a
// server, and a Google button without a client id is a broken link to accounts.google.com.
const disponibles = proveedoresDisponibles();

export const providers: Provider[] = [
  ...(disponibles.email ? [getEmailProvider()] : []),
  ...(disponibles.google ? [getGoogleProvider()] : []),
];
