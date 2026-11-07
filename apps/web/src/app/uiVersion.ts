import type { Translate } from "../i18n/messages";

/**
 * Version of this interface (apps/web/package.json). Vite replaces `__UI_VERSION__` at build and test time
 * (see build-define.ts), so the status bar can tell it apart from the platform version.
 */
export const UI_VERSION: string = __UI_VERSION__;

/**
 * The footer text: «Plataforma X · Interfaz Y» when the platform (X) and the interface (Y) differ, «Versión X» when
 * they are the same version.
 */
export function versionMessage(platformVersion: string, uiVersion: string, translate: Translate): string {
  return platformVersion === uiVersion
    ? translate("state.version", { version: platformVersion })
    : translate("state.versions", { server: platformVersion, ui: uiVersion });
}
