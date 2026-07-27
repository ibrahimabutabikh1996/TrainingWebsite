import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    /* Static assets, not project source. public/admin/ is the standalone admin
       panel this site replaced — it is served as-is and no longer maintained, so
       linting it only produces noise about code nobody edits. */
    "public/**",
  ]),

  /* Plain <img> is the right element in these files, so the rule that pushes
     everything towards next/image is off for them specifically rather than
     silenced line by line.

     Every source here is decided at runtime, not at build time: the landing page
     and the content manager swap `src` on the DOM node directly so the coach can
     preview edits live, and the rest render photos the coach or trainee uploaded.
     next/image needs each host declared up front and its own props for sizing,
     neither of which an arbitrary pasted or uploaded address can supply — and
     writing to `.src` on a next/image node is exactly what the live preview does
     and what next/image does not support. */
  {
    files: [
      "src/app/page.tsx",
      "src/app/admin/cms/AdminCMSClient.tsx",
      "src/app/admin/components/MuscleTabs.tsx",
      "src/components/admin/ProfileDetailsTabs.tsx",
      "src/components/form/Fields.tsx",
    ],
    rules: { "@next/next/no-img-element": "off" },
  },

  /* Theme and language are read from the browser on mount, then the media
     loader fetches when its tab opens. Both are state that only exists on the
     client, so an effect is where they have to be read; the rule's objection is
     one extra render, once. Rewriting these around useSyncExternalStore or a
     server data layer would not change what the user sees, and would put the
     theme, the language and the whole content manager at risk to satisfy a
     warning — so the pattern is kept, deliberately. */
  {
    files: [
      "src/contexts/ThemeContext.tsx",
      "src/contexts/LanguageContext.tsx",
      "src/app/admin/cms/AdminCMSClient.tsx",
    ],
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
]);

export default eslintConfig;
