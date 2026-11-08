export interface DecisionConfianzaHost {
  /** Value for Auth.js' `trustHost`. */
  trustHost: boolean;
  /** Set when the app must not start: the message names what is missing. */
  error?: string;
}

/**
 * Decides whether Auth.js may build absolute URLs (magic links, callbacks) from the request's Host header.
 *
 * - With `AUTH_URL` set, next-auth replaces the request origin with it before Auth.js sees the request, so the
 *   Host header is never used and `trustHost` is safe.
 * - Without `AUTH_URL`, trusting the Host header lets whoever controls it (host-header injection) receive a
 *   magic link pointing at their host. That is only acceptable on a developer's machine: in production the
 *   host is not trusted (every sign-in fails) and the error names the variable; the start script refuses to
 *   launch the production server without it.
 */
export const decidirConfianzaHost = (env: {
  AUTH_URL?: string | undefined;
  NODE_ENV?: string | undefined;
}): DecisionConfianzaHost => {
  const authUrl = env.AUTH_URL?.trim();

  if (authUrl) {
    try {
      new URL(authUrl);
    } catch {
      return { trustHost: false, error: `AUTH_URL is not a valid URL: ${authUrl}` };
    }
    return { trustHost: true };
  }

  if (env.NODE_ENV === "production") {
    return {
      trustHost: false,
      error:
        "AUTH_URL is required in production (the public URL of the app, e.g. https://xpand.example): " +
        "without it the sign-in links would be built from the request's Host header.",
    };
  }

  return { trustHost: true };
};
