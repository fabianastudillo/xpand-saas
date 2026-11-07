import type { KeyboardEvent, ReactElement, ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/Tabs";
import { t, useLocale } from "../i18n";
import { cn } from "../lib/cn";

export interface ShellDocument {
  id: string;
  title: string;
  /** Unsaved changes: shown as a dot and said as «Sin guardar». */
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

const CLOSE =
  "ml-1 inline-flex h-5 w-5 items-center justify-center rounded-sm text-ink-muted hover:bg-surface-sunken " +
  "hover:text-ink focus-visible:outline-2 focus-visible:outline-accent";

/**
 * The open documents (Estudio, Red, Plan · corrida…) as a tablist over the center zone.
 * Arrows, Home and End move and activate (Radix Tabs). Delete on the focused tab closes it; the «×» is a
 * sibling of the tab (a button inside a tab is not allowed) and leaves the tab order (tabIndex -1), so
 * keyboard users close with Delete and pointer users with the «×».
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
  if (documents.length === 0) {
    return <p className="px-3 py-2 text-sm text-ink-muted">{t("shell.documents.empty")}</p>;
  }
  const closeOnDelete = (document: ShellDocument) => (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Delete" && document.closable !== false) {
      event.preventDefault();
      onClose(document.id);
    }
  };
  return (
    <Tabs value={activeId ?? ""} onValueChange={onActivate} className={cn("min-h-0 flex-1", className)}>
      <TabsList aria-label={t("shell.documents.label")} className="shrink-0 overflow-x-auto overflow-y-hidden px-1">
        {documents.map((document) => (
          <div key={document.id} role="none" className="flex items-center">
            <TabsTrigger value={document.id} onKeyDown={closeOnDelete(document)}>
              {document.title}
              {document.dirty === true ? (
                <>
                  <span aria-hidden="true" className="ml-1 text-warn">
                    ●
                  </span>
                  <span className="xp-sr-only">{t("shell.documents.dirty")}</span>
                </>
              ) : null}
            </TabsTrigger>
            {document.closable !== false ? (
              <button
                type="button"
                tabIndex={-1}
                aria-label={t("shell.documents.close", { title: document.title })}
                className={CLOSE}
                onClick={() => {
                  onClose(document.id);
                }}
              >
                <span aria-hidden="true">×</span>
              </button>
            ) : null}
          </div>
        ))}
      </TabsList>
      {activeId !== null ? (
        <TabsContent value={activeId} className="min-h-0 flex-1 overflow-auto">
          {children}
        </TabsContent>
      ) : null}
    </Tabs>
  );
}
