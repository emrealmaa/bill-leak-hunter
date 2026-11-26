import { describe, expect, it } from "vitest";
import { CSP } from "../vite.config";

describe("İçerik Güvenlik Politikası", () => {
  const directives = new Map(CSP.split("; ").map((d) => [d.split(" ")[0], d.split(" ").slice(1)]));

  it("ağ isteklerini tamamen kapatır", () => {
    expect(directives.get("connect-src")).toEqual(["'none'"]);
  });

  it("script ve worker yalnızca uygulamanın kendisinden", () => {
    expect(directives.get("script-src")).toEqual(["'self'"]);
    expect(directives.get("worker-src")).toContain("'self'");
    expect(CSP).not.toContain("unsafe-eval");
    expect(CSP).not.toContain("unsafe-inline");
  });

  it("dış sunuculara izin vermez", () => {
    expect(CSP).not.toMatch(/https?:/);
    expect(directives.get("object-src")).toEqual(["'none'"]);
    expect(directives.get("form-action")).toEqual(["'none'"]);
  });
});
