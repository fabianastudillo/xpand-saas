// Components
export { Badge, type BadgeProps, type BadgeTone, type FreeTone, type StatusTone } from "./components/Badge";
export { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from "./components/Button";
export { Field, type FieldProps } from "./components/Field";
export { Input, type InputProps } from "./components/Input";
export { Kbd, Shortcut, type ShortcutProps } from "./components/Kbd";
export { LocaleName, type LocaleNameProps } from "./components/LocaleName";
export { NumberCell, type NumberCellProps } from "./components/NumberCell";
export { Skeleton, type SkeletonProps } from "./components/Skeleton";
export { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/Tabs";
export { Tooltip, TooltipProvider, toAriaKeyshortcuts, type TooltipProps } from "./components/Tooltip";

// i18n and formatting
export {
  LOCALES,
  LOCALE_NAMES,
  formatNumber,
  getLocale,
  isLocale,
  setLocale,
  subscribeLocale,
  t,
  useLocale,
  type FormatNumberOptions,
  type Locale,
  type MessageKey,
  type TranslationVars,
} from "./i18n";

// Shell (IDE frame)
export { AppShell, useShellLayout, type AppShellProps, type ShellLayout, type ZoneState } from "./shell/AppShell";
export { BottomPanel, type BottomPanelProps, type BottomTab } from "./shell/BottomPanel";
export { CaseTree, type CaseTreeProps, type TreeSelection } from "./shell/CaseTree";
export { CommandPalette, type CommandPaletteProps } from "./shell/CommandPalette";
export { DocumentTabs, type DocumentTabsProps, type ShellDocument } from "./shell/DocumentTabs";
export { Inspector, InspectorRow, InspectorRows, type InspectorProps, type InspectorRowProps } from "./shell/Inspector";
export { ProblemsList, type ProblemsListProps } from "./shell/ProblemsList";
export { StatusBar, type StatusBarProps } from "./shell/StatusBar";
export { TopBar, type TopBarProps } from "./shell/TopBar";
export { filterCommands, groupCommands, normalizeText, type Command, type CommandGroup } from "./shell/commandFilter";
export {
  countBySeverity,
  createProblemsStore,
  problemsStore,
  useProblems,
  type Problem,
  type ProblemAction,
  type ProblemSeverity,
  type ProblemTarget,
  type ProblemTargetKind,
  type ProblemsStore,
  type UseProblems,
} from "./shell/problems";
export {
  isTypingTarget,
  shortcutAriaKeys,
  shortcutLabel,
  useShortcuts,
  type ShortcutBinding,
} from "./shell/shortcuts";
export type { TreeGroup, TreeItem } from "./shell/treeModel";

// Density and helpers
export { DENSITY_ATTRIBUTE, applyDensity, type Density } from "./density";
export { cn } from "./lib/cn";
