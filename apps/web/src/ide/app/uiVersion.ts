import type { Translate } from "../i18n/messages";

/**
 * Version of this interface: the one in apps/web/package.json, which next.config.js hands to the bundle at build
 * (NEXT_PUBLIC_XPAND_UI_VERSION; vitest.config.ts sets it for the unit tests). The status bar tells it apart from the
 * platform version, the one /api/config answers.
 */
export const UI_VERSION: string = process.env["NEXT_PUBLIC_XPAND_UI_VERSION"] ?? "";

/**
 * The footer text: «Plataforma X · Interfaz Y» when the platform (X) and the interface (Y) differ, «Versión X» when
 * they are the same version.
 */
export function versionMessage(platformVersion: string, uiVersion: string, translate: Translate): string {
  return platformVersion === uiVersion
    ? translate("state.version", { version: platformVersion })
    : translate("state.versions", { server: platformVersion, ui: uiVersion });
}
