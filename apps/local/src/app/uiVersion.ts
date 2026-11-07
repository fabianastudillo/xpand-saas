/**
 * Version of this interface (apps/local/package.json). Vite replaces `__UI_VERSION__` at build and test time
 * (see build-define.ts), so the status bar can tell it apart from the server version.
 */
export const UI_VERSION: string = __UI_VERSION__;
