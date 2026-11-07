import type { Catalogo } from "@xpand/api";
import { Field, Input, Skeleton, formatNumber, t, useWindowedRows } from "@xpand/ui";
import type { ReactElement, SyntheticEvent } from "react";
import { Link } from "react-router";
import { casePath, FROM_CATALOG } from "../../lib/casePath";
import { useAppText, type AppMessageKey, type TranslateFn } from "../../i18n/messages";
import { SIZE_BANDS, type CatalogEntry, type CatalogFilters, type SizeBand } from "./catalog";

const ROW_HEIGHT_PX = 60;
const VIEWPORT_FALLBACK_PX = 480;
const WINDOW_THRESHOLD = 200;
const OVERSCAN_ROWS = 6;
const SKELETON_ROWS = 6;
const SELECT_CLASS =
  "h-(--control-h) w-full min-w-0 rounded-md border border-line-strong bg-surface-raised px-2 text-sm text-ink";
const FAST_DIFFICULTY = "rapido";

export interface CatalogDocumentProps {
  catalog: Catalogo | undefined;
  failed: boolean;
  filters: CatalogFilters;
  families: readonly string[];
  visibleEntries: readonly CatalogEntry[];
  onChange: (filters: CatalogFilters) => void;
  onSubmit: (first: CatalogEntry) => void;
}

function sizeKey(size: SizeBand): AppMessageKey {
  return `catalog.size.${size}`;
}

/** The catalog's search and filters, and the windowed list of systems (the catalog has ~2 900 of them). */
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
              type="search"
              autoFocus
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
              const chosen = SIZE_BANDS.find((size) => size === event.target.value) ?? null;
              onChange({ ...filters, size: chosen });
            }}
          >
            <option value="">{translate("catalog.size.all")}</option>
            {SIZE_BANDS.map((size) => (
              <option key={size} value={size}>
                {translate(sizeKey(size))}
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
          <CatalogList entries={visibleEntries} label={translate("catalog.list")} />
        </>
      )}
    </div>
  );
}

function CatalogSkeleton(): ReactElement {
  return (
    <div aria-busy="true" className="flex flex-col gap-2">
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

function CatalogList({ entries, label }: CatalogListProps): ReactElement {
  const { scrollRef, measureRowRef, range, windowed, onScroll } = useWindowedRows({
    count: entries.length,
    threshold: WINDOW_THRESHOLD,
    defaultRowHeight: ROW_HEIGHT_PX,
    defaultViewportHeight: VIEWPORT_FALLBACK_PX,
    overscan: OVERSCAN_ROWS,
  });
  const visible = entries.slice(range.start, range.end);
  return (
    <div ref={scrollRef} onScroll={windowed ? onScroll : undefined} className="min-h-0 flex-1 overflow-auto">
      <div style={windowed ? { height: range.totalHeight, position: "relative" } : undefined}>
        <ul
          aria-label={label}
          className="m-0 list-none p-0"
          style={windowed ? { transform: `translateY(${String(range.offsetTop)}px)` } : undefined}
        >
          {visible.map((entry, offset) => {
            const index = range.start + offset;
            return (
              <CatalogRow
                key={`${entry.engine.id}/${entry.system.id}`}
                entry={entry}
                index={index}
                total={entries.length}
                rowRef={offset === 0 ? measureRowRef : undefined}
              />
            );
          })}
        </ul>
      </div>
    </div>
  );
}

interface CatalogRowProps {
  entry: CatalogEntry;
  index: number;
  total: number;
  rowRef: ((element: HTMLElement | null) => void) | undefined;
}

function CatalogRow({ entry, index, total, rowRef }: CatalogRowProps): ReactElement {
  const translate = useAppText();
  const { engine, system } = entry;
  const difficulty = system.dificultad === undefined ? null : difficultyText(system.dificultad, translate);
  const reference = system.referencias?.[0]?.valor;
  return (
    <li ref={rowRef} aria-setsize={total} aria-posinset={index + 1} className="border-b border-line">
      <Link
        to={casePath(engine.id, system.id)}
        state={FROM_CATALOG}
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
          {difficulty === null ? "" : ` · ${difficulty}`}
          {reference === undefined ? "" : ` · ${translate("catalog.reference")} ${formatNumber(reference, { digits: 2 })}`}
        </span>
      </Link>
    </li>
  );
}

function difficultyText(value: string, translate: TranslateFn): string {
  return value === FAST_DIFFICULTY ? translate("catalog.difficulty", { value: translate("difficulty.fast") }) : value;
}
