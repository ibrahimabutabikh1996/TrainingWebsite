/* Resolves the project's `@/…` import alias for the test runner.
 *
 * `tsconfig.json` maps `@/*` to `src/*`, and Next understands that at build
 * time. Node does not, so importing a module under test that imports one of its
 * own siblings by alias fails to resolve. Twenty lines here is the whole cost of
 * running the real modules rather than a copy of them — and testing a copy is
 * how a test passes while the shipped code is broken.
 */
import { pathToFileURL } from "node:url";
import { resolve as resolvePath } from "node:path";

const SRC = resolvePath(import.meta.dirname, "..", "src");

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const target = resolvePath(SRC, specifier.slice(2));
    /* An alias usually carries no extension, so the candidates below supply
       one — but `""` has to come first when the specifier already ends in a
       real extension, or `@/…/validate.ts` resolves as `validate.ts.ts`. */
    const hasExt = /\.(ts|tsx|mjs|js)$/.test(specifier);
    for (const ext of hasExt ? [""] : [".ts", ".tsx", "/index.ts", ""]) {
      try {
        return nextResolve(pathToFileURL(target + ext).href, context);
      } catch {
        /* try the next candidate */
      }
    }
  }
  return nextResolve(specifier, context);
}
