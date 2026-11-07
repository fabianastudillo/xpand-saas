import type { Catalogo } from "@xpand/api";
import { Field, Input, Skeleton, formatNumber, t, useWindowedRows } from "@xpand/ui";
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactElement, type SyntheticEvent } from "react";
import { Link } from "react-router";
import { casePath, FROM_CATALOG } from "../../lib/casePath";
import { useAppText, type AppMessageKey } from "../../i18n/messages";
import { difficultyLabel } from "./difficulty";
import { SIZE_BANDS, type CatalogEntry, type CatalogFilters, type SizeBand } from "./catalog";

const ROW_HEIGHT_PX = 60;
const VIEWPORT_FALLBACK_PX = 480;
const WINDOW_THRESHOLD = 200;
const OVERSCAN_ROWS = 6;
const SKELETON_ROWS = 6;
const SELECT_CLASS =
  "h-(--control-h) w-full min-w-0 rounded-md border border-line-strong bg-surface-raised px-2 text-sm text-ink";
const NAVIGATION_KEYS = new Set(["ArrowDown", "ArrowUp", "Home", "End"]);

export interface CatalogDocumentProps {
  catalog: Catalogo | undefined;
  failed: boolean;
  filters: CatalogFilters;
  families: readonly string[];
  visibleEntries: readonly CatalogEntry[];
  onChange: (filters: CatalogFilters) => void;
  onSubmit: (first: CatalogEntry) => void;
}

function sizeKey(band: SizeBand): AppMessageKey {
  return `catalog.size.${band}`;
}

/** The catalog's search and filters, and the windowed list of systems (about 3 000 of them). */
export function CatalogDocument({
  catalog,
  failed,
  filters,
  families,
  visibleEntries,
  onChange,
  onSubmit,
}: CatalogDocumentProps): ReactElement {
  const translate = useAppText();
  const engines = catalog?.motores ?? [];
  const searchRef = useRef<HTMLInputElement | null>(null);

  // The search is the primary action of this page: the focus goes there when the page is entered.
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const first = visibleEntries[0];
    if (first !== undefined) onSubmit(first);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
      <form role="search" onSubmit={handleSubmit} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <Field label={translate("catalog.search")} hint={translate("catalog.searchHint")}>
            <Input
              ref={searchRef}
              type="search"
              value={filters.text}
              onChange={(event) => {
                onChange({ ...filters, text: event.target.value });
              }}
            />
          </Field>
        </div>
        <Field label={translate("catalog.engine")}>
          <select
            className={SELECT_CLASS}
            value={filters.engine ?? ""}
            onChange={(event) => {
              onChange({ ...filters, engine: event.target.value === "" ? null : event.target.value });
            }}
          >
            <option value="">{translate("catalog.engine.all")}</option>
            {engines.map((engine) => (
              <option key={engine.id} value={engine.id}>
                {engine.nombre}
              </option>
            ))}
          </select>
        </Field>
        <Field label={translate("catalog.family")}>
          <select
            className={SELECT_CLASS}
            value={filters.family ?? ""}
            onChange={(event) => {
              onChange({ ...filters, family: event.target.value === "" ? null : event.target.value });
            }}
          >
            <option value="">{translate("catalog.family.all")}</option>
            {families.map((family) => (
              <option key={family} value={family}>
                {family}
              </option>
            ))}
          </select>
        </Field>
        <Field label={translate("catalog.size")}>
          <select
            className={SELECT_CLASS}
            value={filters.size ?? ""}
            onChange={(event) => {
              const chosen = SIZE_BANDS.find((band) => band === event.target.value) ?? null;
              onChange({ ...filters, size: chosen });
            }}
          >
            <option value="">{translate("catalog.size.all")}</option>
            {SIZE_BANDS.map((band) => (
              <option key={band} value={band}>
                {translate(sizeKey(band))}
              </option>
            ))}
          </select>
        </Field>
      </form>

      {catalog === undefined ? (
        failed ? (
          <p role="status" className="text-sm text-error-ink">
            {translate("catalog.error")}
          </p>
        ) : (
          <CatalogSkeleton />
        )
      ) : visibleEntries.length === 0 ? (
        <p className="text-sm text-ink-muted">{translate("catalog.empty")}</p>
      ) : (
        <>
          <p className="text-sm text-ink-muted">
            {visibleEntries.length === 1
              ? translate("catalog.count.one")
              : translate("catalog.count", { n: formatNumber(visibleEntries.length, { digits: 0 }) })}
          </p>
          {visibleEntries.some((entry) => entry.system.referencias?.[0] !== undefined) ? (
            <p className="text-xs text-ink-muted">{translate("catalog.referenceLegend")}</p>
          ) : null}
          <CatalogList entries={visibleEntries} label={translate("catalog.list")} />
        </>
      )}
    </div>
  );
}

function CatalogSkeleton(): ReactElement {
  return (
    <div aria-busy="true" data-slot="catalog-loading" className="flex flex-col gap-2">
      <span className="xp-sr-only">{t("common.loading")}</span>
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <Skeleton key={index} height="3.5rem" />
      ))}
    </div>
  );
}

interface CatalogListProps {
  entries: readonly CatalogEntry[];
  label: string;
}

/**
 * The list of systems, windowed: only the rows near the viewport are in the DOM. The focused row is always mounted:
 * outside the window it is pinned at its own offset (as CaseTree does), so scrolling never drops the focus, and it is
 * the single tab stop of the list. Arrow keys, Home and End move the focus and reveal the row they land on.
 */
function CatalogList({ entries, label }: CatalogListProps): ReactElement {
  const [focusIndex, setFocusIndex] = useState(0);
  const focusPending = useRef(false);
  const { scrollRef, measureRowRef, range, rowHeight, windowed, onScroll, reveal } = useWindowedRows({
    count: entries.length,
    threshold: WINDOW_THRESHOLD,
    defaultRowHeight: ROW_HEIGHT_PX,
    defaultViewportHeight: VIEWPORT_FALLBACK_PX,
    overscan: OVERSCAN_ROWS,
  });
  // Clamped on every render: a filter that shortens the list moves the tab stop to its last row.
  const current = Math.min(focusIndex, Math.max(0, entries.length - 1));
  const pinnedIndex = windowed && entries.length > 0 ? current : null;

  // After a key moved the focus, the target row is mounted in the same batch: give it the focus.
  useEffect(() => {
    if (!focusPending.current) return;
    focusPending.current = false;
    scrollRef.current?.querySelector<HTMLElement>(`[data-index="${String(current)}"] a`)?.focus();
  }, [current, scrollRef]);

  const moveFocus = (event: KeyboardEvent<HTMLAnchorElement>, from: number): void => {
    if (!NAVIGATION_KEYS.has(event.key) || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = pickIndex(event.key, from, entries.length - 1);
    event.preventDefault();
    if (target === current) return;
    focusPending.current = true;
    reveal(target);
    setFocusIndex(target);
  };

  const visible = entries
    .slice(range.start, range.end)
    .map((entry, offset) => ({ entry, index: range.start + offset }))
    .filter(({ index }) => index !== pinnedIndex);
  const pinned = pinnedIndex === null ? undefined : entries[pinnedIndex];
  return (
    <div ref={scrollRef} onScroll={windowed ? onScroll : undefined} className="min-h-0 flex-1 overflow-auto">
      <div style={windowed ? { height: range.totalHeight, position: "relative" } : undefined}>
        <ul
          aria-label={label}
          className="m-0 list-none p-0"
          style={windowed ? { position: "relative", transform: `translateY(${String(range.offsetTop)}px)` } : undefined}
        >
          {visible.map(({ entry, index }, offset) => (
            <CatalogRow
              key={`${entry.engine.id}/${entry.system.id}`}
              entry={entry}
              index={index}
              total={entries.length}
              tabbable={!windowed && index === current}
              // Only in the flow layout: a focused row that becomes pinned would be remounted, and lose the focus.
              onFocusRow={
                windowed
                  ? undefined
                  : () => {
                      setFocusIndex(index);
                    }
              }
              onMove={moveFocus}
              rowRef={offset === 0 ? measureRowRef : undefined}
            />
          ))}
          {pinned === undefined || pinnedIndex === null ? null : (
            <CatalogRow
              key={`${pinned.engine.id}/${pinned.system.id}`}
              entry={pinned}
              index={pinnedIndex}
              total={entries.length}
              tabbable
              onFocusRow={undefined}
              onMove={moveFocus}
              rowRef={undefined}
              style={{ position: "absolute", top: pinnedIndex * rowHeight - range.offsetTop, left: 0, right: 0 }}
            />
          )}
        </ul>
      </div>
    </div>
  );
}

function pickIndex(key: string, current: number, last: number): number {
  switch (key) {
    case "ArrowDown":
      return Math.min(current + 1, last);
    case "ArrowUp":
      return Math.max(current - 1, 0);
    case "Home":
      return 0;
    default:
      return last;
  }
}

interface CatalogRowProps {
  entry: CatalogEntry;
  index: number;
  total: number;
  tabbable: boolean;
  /** Set when the row is in the flow layout (see CatalogList). */
  onFocusRow: (() => void) | undefined;
  onMove: (event: KeyboardEvent<HTMLAnchorElement>, from: number) => void;
  rowRef: ((element: HTMLElement | null) => void) | undefined;
  style?: CSSProperties;
}

function CatalogRow({ entry, index, total, tabbable, onFocusRow, onMove, rowRef, style }: CatalogRowProps): ReactElement {
  const translate = useAppText();
  const { engine, system } = entry;
  const difficulty = difficultyLabel(system.dificultad, translate);
  const reference = system.referencias?.[0]?.valor;
  return (
    <li
      ref={rowRef}
      style={style}
      data-index={index}
      aria-setsize={total}
      aria-posinset={index + 1}
      className="border-b border-line"
    >
      <Link
        to={casePath(engine.id, system.id)}
        state={FROM_CATALOG}
        tabIndex={tabbable ? 0 : -1}
        onFocus={onFocusRow}
        onKeyDown={(event) => {
          onMove(event, index);
        }}
        className="flex flex-col gap-0.5 px-3 py-2 text-ink no-underline hover:bg-surface-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="font-medium">{system.nombre}</span>
          <span className="shrink-0 font-mono text-xs text-ink-muted tabular-nums">
            {`${formatNumber(system.barras, { digits: 0 })} ${translate("unit.buses")}`}
          </span>
        </span>
        <span className="text-xs text-ink-muted">
          {engine.nombre}
          {difficulty === null ? "" : ` · ${translate("catalog.difficulty", { value: difficulty })}`}
          {reference === undefined ? "" : ` · ${translate("catalog.reference")} ${formatNumber(reference, { digits: 2 })}`}
        </span>
      </Link>
    </li>
  );
}
