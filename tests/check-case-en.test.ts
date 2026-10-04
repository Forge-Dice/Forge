import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkCaseFolder } from "../src/authoring/check-case.ts";
import { problemText } from "../src/authoring/check-case-en.ts";

const fixture = (name: string) => new URL(`./fixtures/${name}/`, import.meta.url).pathname;

describe("check-case messages in English", () => {
  it("translates the templates, route prefixes included, and leaves German as it is", () => {
    expect(problemText("Weg r2: Status fail, 3 Antwortvektoren bleiben möglich", "en")).toBe("Route r2: status fail, 3 answer vectors remain possible");
    expect(problemText("Übersetzung hat 3 statt 4 Einträge", "en")).toBe("the translation has 3 instead of 4 entries");
    expect(problemText("Lösungsweg bricht bei „Ort durchsuchen“ ab", "en")).toBe("the solution route breaks off at “Ort durchsuchen”");
    expect(problemText("Übersetzung ist leer", "de")).toBe("Übersetzung ist leer");
    expect(problemText("something new", "en")).toBe("something new");
  });

  it("has an English wording for what a broken case and a broken translation report", () => {
    const dir = mkdtempSync(join(tmpdir(), "check-en-"));
    cpSync(fixture("geige"), dir, { recursive: true });
    const edit = (file: string, change: (j: any) => void) => {
      const json = JSON.parse(readFileSync(join(dir, file), "utf8"));
      change(json);
      writeFileSync(join(dir, file), JSON.stringify(json));
    };
    edit("public-content.json", (j) => delete j.epilogue);
    edit("en/public-content.json", (j) => {
      j.labels.pop();
      j.publicRules[0].text = " ";
      delete j.epilogue;
    });
    const messages = [...checkCaseFolder(dir).problems, ...checkCaseFolder(dir, "en").problems].map((p) => p.message);
    expect(messages.length).toBeGreaterThan(2);
    for (const m of messages) expect(problemText(m, "en"), m).not.toMatch(/[äöüß„]|\b(?:der|die|das|nicht|ist|hat|eine?)\b/);
  });
});
