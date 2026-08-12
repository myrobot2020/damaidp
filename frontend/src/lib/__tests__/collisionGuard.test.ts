import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// List of common exports from lib/ that are likely to be used in routes
// and could cause collisions if redefined locally at top-level.
const PROTECTED_EXPORTS = [
    "NIKAYA_OPTIONS",
    "AN_BOOK_TITLES",
    "AN_NIPATA_OPTIONS",
    "DEFAULT_SUTTA_ID",
    "DEFAULT_AN_BOOK",
    "INITIAL_LEAVES_SNAPSHOT",
    "INITIAL_READING_PROGRESS_SNAPSHOT",
    "INITIAL_UX_LOG_SNAPSHOT",
    "UX_LOG_STORAGE_KEY",
    "READING_PROGRESS_KEY",
    "DEFAULT_SETTINGS",
];

describe("Collision Guard", () => {
  const routesDir = path.resolve(__dirname, "../../routes");
  const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith(".tsx"));

  routeFiles.forEach(file => {
    it(`should not have top-level collisions in ${file}`, () => {
      const content = fs.readFileSync(path.join(routesDir, file), "utf-8");

      PROTECTED_EXPORTS.forEach(name => {
        // Look for 'const NAME =' or 'let NAME =' at the start of a line (ignoring indents)
        // This is a simple regex check for the pattern that triggers the TanStack error.
        const re = new RegExp(`^\\s*(const|let|var)\\s+${name}\\s*=`, "m");
        const hasCollision = re.test(content);

        if (hasCollision) {
           throw new Error(
               `Potential TanStack Router collision found in ${file}: ` +
               `Redefinition of '${name}'. Use the shared constant from @/lib instead.`
           );
        }

        expect(hasCollision).toBe(false);
      });
    });
  });
});
