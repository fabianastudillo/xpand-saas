import * as Dialog from "@radix-ui/react-dialog";
import { useLayoutEffect, useRef, useState, type ReactElement } from "react";
import { t, useLocale } from "../i18n";
import { cn } from "../lib/cn";
import type { Command } from "./commandFilter";
import { PaletteBody } from "./PaletteBody";
import { MODAL_SELECTOR, isMacPlatform, isTypingTarget, useShortcuts } from "./shortcuts";

export interface CommandPaletteProps {
  commands: readonly Command[];
  /** Controlled open state; uncontrolled when omitted. Ctrl+K / ⌘K toggles either way. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const OPENER_SELECTOR = "[data-shell-palette-opener]";

/** Who gets the focus back when nothing had it (Safari leaves the body focused after a click). */
function fallbackOpener(): HTMLElement | null {
  return document.querySelector<HTMLElement>(OPENER_SELECTOR) ?? document.querySelector<HTMLElement>("main");
}

/**
 * Ctrl+K: a dialog (Radix, with focus trap) over a combobox + listbox of our own (PaletteBody), so that
 * filtering ignores accents and the ARIA is exact. Focus goes back to the opener on close, and the chosen
 * command runs AFTER that restore, so a command that moves the focus is not undone by it. cmdk was not used:
 * its scorer is not accent-aware and its markup is not ours to fix.
 */
export function CommandPalette({ commands, open, onOpenChange }: CommandPaletteProps): ReactElement {
  useLocale();
  const [ownOpen, setOwnOpen] = useState(false);
  const isOpen = open ?? ownOpen;
  const setOpen = (next: boolean): void => {
    if (open === undefined) setOwnOpen(next);
    onOpenChange?.(next);
  };

  useShortcuts([
    {
      key: "k",
      whileTyping: true,
      whileModal: true,
      when: (event) => {
        // In macOS text fields Ctrl+K is «kill to end of line»: only ⌘K opens from there.
        if (isTypingTarget(event.target) && isMacPlatform() && !event.metaKey) return false;
        // Never over another modal dialog (the palette's own modal is fine: Ctrl+K then closes it).
        return isOpen || document.querySelector(MODAL_SELECTOR) === null;
      },
      run: () => {
        setOpen(!isOpen);
      },
    },
  ]);

  // Radix would return the focus to a DialogTrigger, which this palette has none of (it opens from a key):
  // remember who had the focus when it opened (before the focus trap moves it) and give it back on close.
  const openerRef = useRef<HTMLElement | null>(null);
  const pendingCommand = useRef<Command | null>(null);
  useLayoutEffect(() => {
    if (!isOpen) return;
    const active = document.activeElement;
    openerRef.current = active instanceof HTMLElement && active !== document.body ? active : null;
  }, [isOpen]);

  const onCloseAutoFocus = (event: Event): void => {
    event.preventDefault();
    (openerRef.current ?? fallbackOpener())?.focus();
    const command = pendingCommand.current;
    pendingCommand.current = null;
    command?.run();
  };

  const choose = (command: Command): void => {
    pendingCommand.current = command;
    setOpen(false);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/20" />
        <Dialog.Content
          data-slot="command-palette"
          aria-describedby={undefined}
          onCloseAutoFocus={onCloseAutoFocus}
          className={cn(
            "fixed top-[12vh] left-1/2 z-50 w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2",
            "overflow-hidden rounded-lg border border-line bg-surface-raised shadow-pop",
          )}
        >
          <Dialog.Title className="xp-sr-only">{t("shell.palette.title")}</Dialog.Title>
          {isOpen ? <PaletteBody commands={commands} onChoose={choose} /> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
