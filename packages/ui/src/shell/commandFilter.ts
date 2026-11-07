export interface Command {
  id: string;
  label: string;
  /** Heading the command is listed under («Casos», «Ejecutar»). */
  group: string;
  /** Keys with `+` between them: "Ctrl+Enter". Shown as <kbd>; the palette does not bind it. */
  shortcut?: string;
  run: () => void;
}

export interface CommandGroup {
  group: string;
  commands: readonly Command[];
}

const DIACRITICS = /\p{M}/gu;
const WHITESPACE = /\s+/;

/** Lowercase, trimmed and without diacritics, so «reduccion» matches «Reducción». */
export function normalizeText(text: string): string {
  return text.normalize("NFD").replace(DIACRITICS, "").toLowerCase().trim();
}

/** Every word of the query must appear in the label or the group, in any order. */
export function filterCommands(commands: readonly Command[], query: string): readonly Command[] {
  const words = normalizeText(query).split(WHITESPACE).filter((word) => word.length > 0);
  if (words.length === 0) return commands;
  return commands.filter((command) => {
    const haystack = `${normalizeText(command.label)} ${normalizeText(command.group)}`;
    return words.every((word) => haystack.includes(word));
  });
}

/** Groups in first-seen order, commands kept in their original order inside each group. */
export function groupCommands(commands: readonly Command[]): readonly CommandGroup[] {
  const order: string[] = [];
  const byGroup = new Map<string, Command[]>();
  for (const command of commands) {
    const bucket = byGroup.get(command.group);
    if (bucket) {
      bucket.push(command);
    } else {
      order.push(command.group);
      byGroup.set(command.group, [command]);
    }
  }
  return order.map((group) => ({ group, commands: byGroup.get(group) ?? [] }));
}
