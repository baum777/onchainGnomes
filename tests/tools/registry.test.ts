import { describe, it, expect } from "vitest";
import { toolRegistry } from "../../src/tools/registry.js";

describe("toolRegistry", () => {
  it("should list all 3 tools", () => {
    const tools = toolRegistry.listTools();
    expect(tools.length).toBe(3);
    const names = tools.map(t => t.name);
    expect(names).toContain("onchain");
    expect(names).toContain("market");
    expect(names).toContain("policy");
  });

  it("should return tool definition by name", () => {
    const tool = toolRegistry.getTool("onchain");
    expect(tool).toBeDefined();
    expect(tool?.readOnly).toBe(true);
    expect(tool?.supportedChains).toContain("solana");
  });

  it("should return undefined for unknown tool", () => {
    const tool = toolRegistry.getTool("unknown" as any);
    expect(tool).toBeUndefined();
  });

  it("all tools should be read-only", () => {
    const tools = toolRegistry.listTools();
    for (const tool of tools) {
      expect(tool.readOnly).toBe(true);
    }
  });
});
