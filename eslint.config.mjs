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
    /* Throwaway scripts written at the terminal. Not application source, not
       committed (see .gitignore), and not worth a lint error each. */
    "scratch/**",
  ]),

  /* Plain <img> is the right element in these files, so the rule that pushes
     everything towards next/image is off for them specifically rather than
     silenced line by line. Two reasons, and every file below is one or the
     other:

     Runtime-decided sources. The landing page and the content manager swap
     `src` on the DOM node directly so the coach can preview edits live, and the
     rest render photos the coach or trainee uploaded. next/image needs each
     host declared up front and its own props for sizing, neither of which an
     arbitrary pasted or uploaded address can supply — and writing to `.src` on
     a next/image node is exactly what the live preview does and what next/image
     does not support.

     Brand marks on loading and chrome. A fixed-size logo out of /public, drawn
     once at a known size on a screen that exists to be replaced as soon as the
     data arrives. next/image's optimiser has nothing to save here and its
     wrapper is one more thing between the spinner and the paint. */
  {
    files: [
      // Runtime-decided sources
      "src/app/LandingClient.tsx",
      "src/app/admin/cms/AdminCMSClient.tsx",
      "src/app/admin/components/MuscleTabs.tsx",
      "src/app/admin/diet/AdminDietClient.tsx",
      "src/app/admin/diet/NutritionFormModal.tsx",
      "src/app/admin/diet/plan/DietPlanBuilder.tsx",
      "src/app/export-profile/ExportProfileClient.tsx",
      "src/components/PromotionalPopup.tsx",
      "src/components/admin/ProfileMonthlyRecord.tsx",
      "src/components/admin/TraineeIntakeHelp.tsx",
      "src/components/dashboard/TraineeProfileDetails.tsx",
      "src/components/form/Fields.tsx",
      // Brand marks on loading screens and page chrome
      "src/app/loading.tsx",
      "src/app/not-found.tsx",
      "src/app/admin/loading.tsx",
      "src/app/admin/layout.tsx",
      "src/app/dashboard/page.tsx",
      /* These two name the client halves, not the pages: /form and /login are
         server components whose header and loading screen live in
         FormClient and LoginScreen. The entries used to name the page files,
         which hold no <img> at all any more and were exempting nothing. */
      "src/app/form/FormClient.tsx",
      "src/components/auth/LoginScreen.tsx",
    ],
    rules: { "@next/next/no-img-element": "off" },
  },

  /* The one place a plain <a> to an internal route is the right element.
   *
   * `global-error.tsx` renders when the root layout itself threw, and it
   * replaces the whole document — its own <html> and <body>. `<Link>` performs
   * a client-side navigation through the router that lives in the tree which
   * has just failed, which is the one route out of here that cannot be relied
   * on. A plain anchor asks the server for a fresh document instead, and a
   * fresh document is exactly the recovery this screen is offering.
   *
   * Scoped to the single file on purpose: everywhere else, the rule is right. */
  {
    files: ["src/app/global-error.tsx"],
    rules: { "@next/next/no-html-link-for-pages": "off" },
  },

  /* Four places read something that only exists in the browser — saved
     preferences, session storage, the clock — and put it into state on mount.
     The rule is right that this costs one extra render; in each of these the
     alternative costs more than it buys:

       AdminCMSClient      the media library fetches when its tab is first
                           opened. Rewriting the manager around a server data
                           layer would not change what the coach sees.
       LandingClient       the landing page's live CMS preview reads
                           localStorage and subscribes to `storage`, then
                           writes the result straight into the DOM. It only
                           runs under ?preview=true. (The page itself is a
                           server component now; this is the client half.)
       admin/layout.tsx    the sidebar's saved collapsed state, plus a media
                           query for narrow viewports.
       PromotionalPopup    a countdown priming its first value so the banner
                           does not show a blank second before the first tick.

     Every other instance of this rule in the codebase was removed rather than
     listed here: state that merely followed a prop now follows it during
     render (see CustomDatePicker and AccountManager), a form that reset itself
     is remounted with a `key` instead (NutritionFormModal), and a menu that
     cleared itself on close now does it in the close handler
     (DayMusclePicker).

     This list used to name src/contexts/ThemeContext.tsx and
     LanguageContext.tsx as well. That directory no longer exists — theme and
     language are not read from the browser any more — so those two entries
     were exempting nothing. */
  {
    files: [
      "src/app/admin/cms/AdminCMSClient.tsx",
      "src/app/LandingClient.tsx",
      "src/app/admin/layout.tsx",
      "src/components/PromotionalPopup.tsx",
    ],
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
]);

export default eslintConfig;
