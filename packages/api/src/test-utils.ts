/** Shared helpers for the test files. Not exported from the package index. */

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function urlOf(input: RequestInfo | URL): string {
  return input instanceof Request ? input.url : input.toString();
}
