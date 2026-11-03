import type { Instrumentation } from "next";

/* Every error the server did not catch — a page that failed to render, a route
   handler or server action that threw — passes through here before Next shows
   the error screen. It is sent on to the owner's inbox by `@/lib/errorAlert`.

   Node only. The alert needs nodemailer and the database, neither of which
   exists in the Edge runtime, and importing them at the top of this file would
   pull them into the Edge bundle too — hence the import inside the check. */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { sendErrorAlert } = await import("@/lib/errorAlert");
  const error = err instanceof Error ? err : null;
  const digest =
    typeof err === "object" && err !== null && "digest" in err ? String(err.digest) : undefined;
  const userAgent = request.headers["user-agent"];

  await sendErrorAlert({
    name: error?.name ?? "Error",
    message: error?.message ?? String(err),
    stack: error?.stack,
    digest,
    source: "server",
    path: request.path,
    method: request.method,
    routePath: context.routePath,
    routeType: context.routeType,
    userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
  });
};
