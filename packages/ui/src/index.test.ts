import { describe, expect, it } from "vitest";
import * as ui from "./index";

const PUBLIC_EXPORTS = [
  "Badge",
  "Button",
  "Field",
  "Input",
  "Kbd",
  "Shortcut",
  "NumberCell",
  "Skeleton",
  "Tabs",
  "TabsList",
  "TabsTrigger",
  "TabsContent",
  "Tooltip",
  "TooltipProvider",
  "LocaleName",
  "LOCALE_NAMES",
  "t",
  "getLocale",
  "setLocale",
  "useLocale",
  "formatNumber",
  "cn",
  "DENSITY_ATTRIBUTE",
] as const;

describe("@xpand/ui", () => {
  it.each(PUBLIC_EXPORTS)("exports %s", (name) => {
    expect(ui).toHaveProperty(name);
  });
});
