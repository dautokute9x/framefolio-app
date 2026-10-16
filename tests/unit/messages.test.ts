import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import vi from "@/messages/vi.json";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string" ? [`${prefix}${key}`] : flatten(value, `${prefix}${key}.`)
  );
}

function has(tree: Tree, dotted: string) {
  let node: string | Tree | undefined = tree;
  for (const part of dotted.split(".")) {
    if (typeof node !== "object" || !(part in node)) return false;
    node = node[part];
  }
  return true;
}

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : sourceFiles(full);
    return /\.(tsx?|mjs)$/.test(entry.name) ? [full] : [];
  });
}

describe("translations", () => {
  it("Vietnamese and English define exactly the same keys", () => {
    expect(flatten(en as Tree).sort()).toEqual(flatten(vi as Tree).sort());
  });

  it("every literal key used in the code exists", () => {
    const root = path.resolve(__dirname, "../..");
    const missing: string[] = [];
    for (const file of ["app", "components", "lib"].flatMap((dir) => sourceFiles(path.join(root, dir)))) {
      const source = fs.readFileSync(file, "utf8");
      const namespaces = [...source.matchAll(/(?:use|get)Translations\(\s*"([\w.]+)"\s*\)/g)].map((m) => m[1]);
      if (!namespaces.length) continue;
      for (const match of source.matchAll(/\bt[A-Z]?\w*\(\s*"([\w.]+)"/g)) {
        const key = match[1];
        if (!namespaces.some((ns) => has(vi as Tree, `${ns}.${key}`))) {
          missing.push(`${path.relative(root, file)}: ${key} (namespaces: ${namespaces.join(", ")})`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
