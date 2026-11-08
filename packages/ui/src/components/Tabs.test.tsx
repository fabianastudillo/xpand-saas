import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./Tabs";

function renderTabs() {
  return render(
    <Tabs defaultValue="caso">
      <TabsList aria-label="Panel izquierdo">
        <TabsTrigger value="caso">Caso</TabsTrigger>
        <TabsTrigger value="proyecto">Proyecto</TabsTrigger>
        <TabsTrigger value="corridas">Corridas</TabsTrigger>
      </TabsList>
      <TabsContent value="caso">Árbol del caso</TabsContent>
      <TabsContent value="proyecto">Proyecto</TabsContent>
      <TabsContent value="corridas">Corridas previas</TabsContent>
    </Tabs>,
  );
}

describe("<Tabs>", () => {
  it("exposes a tablist with tabs and shows the default panel", () => {
    renderTabs();
    expect(screen.getByRole("tablist", { name: "Panel izquierdo" })).toBeTruthy();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByRole("tab", { name: "Caso" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel").textContent).toBe("Árbol del caso");
  });

  it("moves with the arrow keys and activates the focused tab", async () => {
    const user = userEvent.setup();
    renderTabs();
    await user.click(screen.getByRole("tab", { name: "Caso" }));
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Proyecto" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel").textContent).toBe("Proyecto");
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Corridas" })).toHaveAttribute("aria-selected", "true");
  });

  it("styles the active tab with the accent underline, not a filled pill", () => {
    renderTabs();
    const active = screen.getByRole("tab", { name: "Caso" });
    expect(active.className).toMatch(/data-\[state=active\]:border-accent/);
    expect(active.className).not.toMatch(/data-\[state=active\]:bg-/);
  });
});
