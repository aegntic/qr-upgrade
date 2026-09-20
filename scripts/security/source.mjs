import { createHash } from "node:crypto";
import { readdir, readFile, lstat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const excluded = new Set([
  "node_modules",
  ".next",
  ".open-next",
  ".git",
  ".workflows",
  ".superpowers",
  ".wrangler",
  ".vercel",
  ".expo",
  "dist",
  "build",
  "Pods",
  ".gradle",
  ".kotlin",
]);
export async function sourceDigest(base = root) {
  const hash = createHash("sha256");
  async function walk(dir) {
    for (const entry of (await readdir(dir, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      const full = path.join(dir, entry.name),
        rel = path.relative(base, full).split(path.sep).join("/");
      if (
        excluded.has(entry.name) ||
        /^(research\/|compliance\/evidence\/|mobile\/(android|ios)\/)/.test(
          rel,
        ) ||
        /\.(tsbuildinfo|log)$/.test(rel) ||
        entry.name.startsWith(".env") ||
        entry.name.startsWith(".dev.vars")
      )
        continue;
      if (entry.isSymbolicLink())
        throw new Error(`Source symlink requires review: ${rel}`);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) {
        hash.update(rel + "\0");
        hash.update(await readFile(full));
        hash.update("\0");
      }
    }
  }
  await walk(base);
  return hash.digest("hex");
}
export async function artifactHash(evidenceRoot, relative) {
  if (
    typeof relative !== "string" ||
    !relative ||
    path.isAbsolute(relative) ||
    relative.split(/[\\/]/).some((p) => p === ".." || p === "")
  )
    throw new Error("Invalid evidence path.");
  let cursor = evidenceRoot;
  for (const part of relative.split("/")) {
    cursor = path.join(cursor, part);
    if ((await lstat(cursor)).isSymbolicLink())
      throw new Error("Evidence symlinks are not allowed.");
  }
  const stat = await lstat(cursor);
  if (!stat.isFile() || stat.size === 0)
    throw new Error("Evidence must be a non-empty file.");
  return createHash("sha256")
    .update(await readFile(cursor))
    .digest("hex");
}
