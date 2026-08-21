/* Installs the `@/…` resolver before the test files load. See alias-loader.mjs. */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./alias-loader.mjs", pathToFileURL(import.meta.filename));
