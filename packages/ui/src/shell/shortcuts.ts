import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * Application shortcuts: Ctrl (or ⌘ on macOS) + one letter.
 *
 * Known browser conflicts, all overridable with preventDefault on keydown: Ctrl+K (Firefox: focus the search
 * bar), Ctrl+B (Firefox: bookmarks sidebar), Ctrl+I (Firefox: page info), Ctrl+J (Chrome: downloads). Inside
 * text fields Ctrl+B / Ctrl+I mean bold / italic in rich editors, so bindings are skipped while typing unless
 * they opt in with `whileTyping` (the command palette does). While a modal dialog is open the shell is not
 * reachable, so bindings are skipped unless they opt in with `whileModal`. Ctrl+T, Ctrl+W and Ctrl+N are
 * reserved by the browsers and are never used.
 */
export interface ShortcutBinding {
  /** One key, case-insensitive: "b", "k". */
  key: string;
  run: (event: KeyboardEvent) => void;
  /** Also fire when the focus is in a text field. Default false. */
  whileTyping?: boolean;
  /** Also fire while an `aria-modal` dialog is open. Default false. */
  whileModal?: boolean;
  /** Extra condition, evaluated before the default is prevented; false lets the browser keep the key. */
  when?: (event: KeyboardEvent) => boolean;
}

const NON_TEXT_INPUT_TYPES = new Set(["button", "checkbox", "radio", "range", "submit", "reset", "file", "color"]);
const EDITABLE_VALUES = new Set(["", "true", "plaintext-only"]);
/** Open modal dialogs: ARIA's own marker, plus Radix Dialog, which sets role and data-state but no aria-modal. */
export const MODAL_SELECTOR = '[aria-modal="true"], [role="dialog"][data-state="open"]';

function isEditable(element: HTMLElement): boolean {
  // isContentEditable covers inherited editability; the attribute covers jsdom, which does not implement it.
  const attribute = element.getAttribute("contenteditable");
  return element.isContentEditable || (attribute !== null && EDITABLE_VALUES.has(attribute));
}

/** True when key presses on the target type text (inputs, textareas, selects, contenteditable). */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (isEditable(target)) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  return target instanceof HTMLInputElement && !NON_TEXT_INPUT_TYPES.has(target.type);
}

/** Ctrl on every platform, ⌘ on macOS. Shift and Alt are not part of any shell shortcut. */
export function matchesShortcut(event: KeyboardEvent, key: string): boolean {
  const modifier = event.ctrlKey !== event.metaKey; // exactly one of them
  return modifier && !event.altKey && !event.shiftKey && event.key.toLowerCase() === key.toLowerCase();
}

function applies(binding: ShortcutBinding, event: KeyboardEvent, typing: boolean, modal: boolean): boolean {
  if (!matchesShortcut(event, binding.key)) return false;
  if (typing && binding.whileTyping !== true) return false;
  if (modal && binding.whileModal !== true) return false;
  return binding.when?.(event) ?? true;
}

/** One keydown listener on the document for the given bindings; the latest bindings are always used. */
export function useShortcuts(bindings: readonly ShortcutBinding[]): void {
  const latest = useRef(bindings);
  useLayoutEffect(() => {
    latest.current = bindings;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.repeat) return;
      const typing = isTypingTarget(event.target);
      const modal = document.querySelector(MODAL_SELECTOR) !== null;
      const binding = latest.current.find((candidate) => applies(candidate, event, typing, modal));
      if (!binding) return;
      event.preventDefault();
      binding.run(event);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);
}

/** Apple platforms show ⌘; navigator.platform is deprecated, so the user agent string is read instead. */
export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Macintosh|Mac OS|iPhone|iPad/.test(navigator.userAgent);
}

/** Display form of a shortcut: "Ctrl+K", or "⌘+K" on macOS. */
export function shortcutLabel(key: string, mac: boolean = isMacPlatform()): string {
  return `${mac ? "⌘" : "Ctrl"}+${key}`;
}

/** aria-keyshortcuts for a Ctrl/⌘ shortcut: both forms, since either modifier is accepted. */
export function shortcutAriaKeys(key: string): string {
  return `Control+${key} Meta+${key}`;
}
