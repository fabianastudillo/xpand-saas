import { expect, test } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";

/**
 * The IDE zone needs no database. This suite starts a second server of the app whose DATABASE_URL points to a port
 * where nothing listens (Postgres "down") and checks that: «Explorar casos» still lists the public cases, the API of
 * the cases answers, and the sign-in page says that an error occurred.
 *
 * The second server is `next start` on the build the first one made (CI) or `next dev` with its own build folder
 * (local), on its own port.
 */
const PORT = process.env.XPAND_WEB_PORT_SIN_POSTGRES ?? "8871";
const BASE = `http://localhost:${PORT}`;
const APP_DIR = path.resolve(__dirname, "../..");
const STORE = path.resolve(APP_DIR, "../../packages/casos/test/almacen");
const DEAD_DATABASE = "postgresql://nadie:nada@127.0.0.1:1/nada?schema=public&connect_timeout=2";
const START_TIMEOUT_MS = 180_000;

let server: ChildProcess | undefined;
let serverLog = "";

async function isUp(url: string): Promise<boolean> {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(5000) })).ok;
  } catch {
    return false;
  }
}

async function waitUntilUp(url: string): Promise<void> {
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (server?.exitCode != null) throw new Error(`the server without a database exited early:\n${serverLog}`);
    if (await isUp(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`the server without a database did not answer in time:\n${serverLog}`);
}

test.describe("without Postgres", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(START_TIMEOUT_MS + 60_000);

  test.beforeAll(async () => {
    const mode = process.env.CI ? "start" : "dev";
    server = spawn(process.execPath, ["scripts/arranque.mjs", mode], {
      cwd: APP_DIR,
      env: {
        ...process.env,
        DATABASE_URL: DEAD_DATABASE,
        XPAND_WEB_PORT: PORT,
        AUTH_URL: `http://127.0.0.1:${PORT}`,
        XPAND_ALMACEN: STORE,
        ...(mode === "dev" ? { XPAND_DIST_DIR: ".next-sin-postgres" } : {}),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    server.stdout?.on("data", (chunk: Buffer) => (serverLog += chunk.toString()));
    server.stderr?.on("data", (chunk: Buffer) => (serverLog += chunk.toString()));
    await waitUntilUp(`${BASE}/api/config`);
  });

  test.afterAll(() => {
    server?.kill("SIGTERM");
  });

  test("«Explorar casos» lists the public cases and opens one", async ({ page }) => {
    await page.goto(`${BASE}/casos`);

    await expect(page.getByRole("list", { name: "Sistemas" }).getByRole("link")).toHaveCount(3);
    await page.getByRole("link", { name: /Garver 6 — benchmark/ }).last().click();
    await expect(page.getByRole("tree", { name: "Árbol del caso" })).toBeVisible();
  });

  test("the API of the cases answers and the session reads as «outside»", async ({ request }) => {
    const catalog = await request.get(`${BASE}/api/catalogo`);
    const session = await request.get(`${BASE}/api/sesion`);

    expect(catalog.ok()).toBe(true);
    expect(((await catalog.json()) as { motores: unknown[] }).motores).toHaveLength(2);
    expect(await session.json()).toMatchObject({ dentro: false, exigida: false });
  });

  test("a public page of the site still loads", async ({ page }) => {
    const response = await page.goto(`${BASE}/pricing`);

    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  });

  test("an account page sends the visitor to the sign-in page, which loads", async ({ page }) => {
    const response = await page.goto(`${BASE}/dashboard`);

    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Sign in or create an account" })).toBeVisible();
  });

  test("signing in says that an error occurred instead of failing blank", async ({ page }) => {
    await page.goto(`${BASE}/login`);

    await page.getByLabel("Email").fill("alguien@example.com");
    await page.getByRole("button", { name: /e-?mail|magic|sign in/i }).first().click();

    await expect(page.getByText("An error occurred. Please try again.")).toBeVisible();
  });
});
