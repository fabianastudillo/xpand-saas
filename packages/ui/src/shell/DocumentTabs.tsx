import { useEffect, useId, useRef, type KeyboardEvent, type ReactElement, type ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/Tabs";
import { t, useLocale } from "../i18n";
import { cn } from "../lib/cn";

export interface ShellDocument {
  id: string;
  title: string;
  /** Unsaved changes: shown as a dot and said as «, Sin guardar». */
  dirty?: boolean;
  /** Default true. The study of a case or a pinned run may not be closable. */
  closable?: boolean;
}

export interface DocumentTabsProps {
  documents: readonly ShellDocument[];
  activeId: string | null;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  /** The active document's content. */
  children?: ReactNode;
  className?: string;
}

const CLOSE_KEYS = "Delete Control+Backspace";
const CLOSE =
  "ml-0.5 inline-flex h-6 w-6 items-center justify-center rounded-sm text-ink-muted hover:bg-surface-sunken hover:text-ink";

/**
 * Radix derives the element ids of a tab and its panel from its value, and ids must not hold spaces or stray
 * characters. Each character outside [A-Za-z0-9] is escaped as `_<hex>_` (the underscore too), so the mapping is
 * injective and the value is IDREF-safe whatever the document identifier is (a case may be "SNI año/2032 ñ").
 */
export function tabValue(documentId: string): string {
  return Array.from(documentId, (character) =>
    /[A-Za-z0-9-]/.test(character) ? character : `_${character.codePointAt(0)?.toString(16) ?? "0"}_`,
  ).join("");
}

interface PendingFocus {
  closedId: string;
  nextId: string | null;
}

/** The tab of a document, found by its identifier (never by a selector built from it). */
function triggerOf(list: HTMLElement | null, documentId: string): HTMLElement | null {
  if (list === null) return null;
  return [...list.querySelectorAll<HTMLElement>("[data-document-id]")].find((element) => element.dataset["documentId"] === documentId) ?? null;
}

function isCloseKey(event: KeyboardEvent): boolean {
  return event.key === "Delete" || (event.key === "Backspace" && (event.ctrlKey || event.metaKey));
}

/**
 * The open documents (Estudio, Red, Plan · corrida…) as a tablist over the center zone.
 * Arrows, Home and End only move the focus; Enter and Space activate (Radix Tabs, manual activation): activating
 * a document navigates and mounts a page, and that must not happen on every arrow press, nor take the focus away
 * from the tablist. Keyboard users close the focused tab with Delete or
 * Ctrl+Backspace (announced through aria-keyshortcuts and a described-by hint; the palette offers «Cerrar
 * documento activo» too). The «×» is a decorative pointer target (aria-hidden, not focusable): a button
 * inside a tablist is not allowed. After closing the focused tab, the focus moves to its neighbour.
 */
export function DocumentTabs({
  documents,
  activeId,
  onActivate,
  onClose,
  children,
  className,
}: DocumentTabsProps): ReactElement {
  useLocale();
  const hintId = useId();
  const listRef = useRef<HTMLDivElement | null>(null);
  const pendingFocus = useRef<PendingFocus | null>(null);

  // Once the closed document is gone, the neighbour computed at close time takes the focus.
  useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    if (documents.some((document) => document.id === pending.closedId)) return; // not closed (yet)
    pendingFocus.current = null;
    if (pending.nextId === null) return;
    triggerOf(listRef.current, pending.nextId)?.focus();
  }, [documents]);

  const documentOf = (value: string): ShellDocument | undefined => documents.find((entry) => tabValue(entry.id) === value);

  if (documents.length === 0) {
    return <p className="px-3 py-2 text-sm text-ink-muted">{t("shell.documents.empty")}</p>;
  }

  const close = (document: ShellDocument, trigger: HTMLElement | null): void => {
    if (document.closable === false) return;
    const index = documents.findIndex((candidate) => candidate.id === document.id);
    const neighbour = documents[index + 1] ?? documents[index - 1];
    const hadFocus = trigger !== null && trigger === globalThis.document.activeElement;
    pendingFocus.current = { closedId: document.id, nextId: hadFocus ? (neighbour?.id ?? null) : null };
    onClose(document.id);
  };

  return (
    <Tabs
      value={activeId === null ? "" : tabValue(activeId)}
      activationMode="manual"
      onValueChange={(value) => {
        const document = documentOf(value);
        if (document !== undefined) onActivate(document.id);
      }}
      className={cn("min-h-0 flex-1", className)}
    >
      <span id={hintId} className="xp-sr-only">
        {t("shell.documents.closeHint")}
      </span>
      <TabsList ref={listRef} aria-label={t("shell.documents.label")} className="shrink-0 overflow-x-auto overflow-y-hidden px-1">
        {documents.map((document) => {
          const closable = document.closable !== false;
          return (
            <div key={document.id} role="none" className="flex items-center">
              <TabsTrigger
                value={tabValue(document.id)}
                data-document-id={document.id}
                className="pr-1"
                {...(closable ? { "aria-keyshortcuts": CLOSE_KEYS, "aria-describedby": hintId } : {})}
                onKeyDown={(event) => {
                  if (!isCloseKey(event)) return;
                  event.preventDefault();
                  close(document, event.currentTarget);
                }}
              >
                {document.title}
                {document.dirty === true ? (
                  <>
                    <span aria-hidden="true" className="ml-1 text-warn">
                      ●
                    </span>
                    <span className="xp-sr-only">, {t("shell.documents.dirty")}</span>
                  </>
                ) : null}
              </TabsTrigger>
              {closable ? (
                <span
                  data-slot="document-close"
                  aria-hidden="true"
                  className={CLOSE}
                  onClick={() => {
                    close(document, triggerOf(listRef.current, document.id));
                  }}
                >
                  ×
                </span>
              ) : null}
            </div>
          );
        })}
      </TabsList>
      {/* A bounded column: the document scrolls itself (a long list windows inside it), the tabs stay put. */}
      {activeId !== null ? (
        <TabsContent value={tabValue(activeId)} className="flex min-h-0 flex-1 flex-col overflow-auto">
          {children}
        </TabsContent>
      ) : null}
    </Tabs>
  );
}
