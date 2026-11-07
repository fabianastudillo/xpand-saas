import { useEffect, useRef } from "react";

/**
 * Application shortcuts: Ctrl (or ⌘ on macOS) + one letter.
 *
 * Known browser conflicts, all overridable with preventDefault on keydown: Ctrl+K (Firefox: focus the search
 * bar), Ctrl+B (Firefox: bookmarks sidebar), Ctrl+I (Firefox: page info), Ctrl+J (Chrome: downloads). Inside
 * text fields Ctrl+B / Ctrl+I mean bold / italic in rich editors, so bindings are skipped while typing unless
 * they opt in with `whileTyping` (the command palette does). Ctrl+T, Ctrl+W and Ctrl+N are reserved by the
 * browsers and are never used.
 */
export interface ShortcutBinding {
  /** One key, case-insensitive: "b", "k". */
  key: string;
  run: (event: KeyboardEvent) => void;
  /** Also fire when the focus is in a text field. Default false. */
  whileTyping?: boolean;
}

const NON_TEXT_INPUT_TYPES = new Set(["button", "checkbox", "radio", "range", "submit", "reset", "file", "color"]);

const EDITABLE_VALUES = new Set(["", "true", "plaintext-only"]);

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

/** One keydown listener on the document for the given bindings; the latest bindings are always used. */
export function useShortcuts(bindings: readonly ShortcutBinding[]): void {
  const latest = useRef(bindings);
  latest.current = bindings;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.repeat) return;
      const typing = isTypingTarget(event.target);
      const binding = latest.current.find(
        (candidate) => matchesShortcut(event, candidate.key) && (!typing || candidate.whileTyping === true),
      );
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
