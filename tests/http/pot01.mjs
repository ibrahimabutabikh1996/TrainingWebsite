/* POT-01 — can the origin the PDF renderer trusts be steered by a header?
 *
 * `renderPagePdf` builds the URL Chrome visits, and the domain it pins the
 * session cookie to, from `request.nextUrl.origin`. If that origin follows a
 * header the caller writes, an authenticated caller could point the headless
 * browser somewhere else and read the result back as a PDF.
 *
 * Probed through `GET /api/export-workout`, which redirects to a fixed path
 * built from the same `nextUrl` and therefore echoes the computed origin in its
 * Location header. No application code is touched to observe it.
 *
 * Raw sockets, not fetch/curl: both rewrite `Host` from the URL, so a test
 * built on them cannot tell "the server ignored my header" from "my header was
 * never sent".
 */
import net from "node:net";

/* Port is a parameter so the same probe can be run against the dev server and
   against a production build, which resolve request URLs differently. */
const PORT = Number(process.env.PROBE_PORT || 3000);

function rawRequest(headerLines) {
  return new Promise((resolve) => {
    const sock = net.connect(PORT, "127.0.0.1", () => {
      sock.write(
        `GET /api/export-workout?probe=1 HTTP/1.1\r\n${headerLines.join("\r\n")}\r\nConnection: close\r\n\r\n`
      );
    });
    let buf = "";
    sock.on("data", (d) => (buf += d.toString("latin1")));
    sock.on("end", () => resolve(buf));
    sock.on("error", (e) => resolve(`ERROR: ${e.message}`));
    setTimeout(() => { sock.destroy(); resolve(buf || "TIMEOUT"); }, 8000);
  });
}

const statusOf = (r) => (r.split("\r\n")[0] || "").trim();
const locationOf = (r) => {
  const m = r.match(/^location:\s*(.+)$/im);
  return m ? m[1].trim() : "(none)";
};

const cases = [
  ["baseline (honest Host)", ["Host: localhost:3000"]],
  ["forged Host", ["Host: evil.example"]],
  ["forged Host + port", ["Host: evil.example:8080"]],
  ["X-Forwarded-Host", ["Host: localhost:3000", "X-Forwarded-Host: evil.example"]],
  ["XFH + XF-Proto", ["Host: localhost:3000", "X-Forwarded-Host: evil.example", "X-Forwarded-Proto: https"]],
  ["cloud metadata IP as Host", ["Host: 169.254.169.254"]],
  ["metadata IP via XFH", ["Host: localhost:3000", "X-Forwarded-Host: 169.254.169.254"]],
  ["internal host via XFH", ["Host: localhost:3000", "X-Forwarded-Host: 127.0.0.1:9999"]],
  ["absolute-URI request line style", ["Host: evil.example", "X-Forwarded-Host: evil.example", "X-Forwarded-Proto: https", "Forwarded: host=evil.example"]],
];

console.log("=".repeat(74));
console.log("POT-01 — is `nextUrl.origin` steerable by a request header?");
console.log(`probe: GET /api/export-workout on port ${PORT} (Location echoes the computed origin)`);
console.log("=".repeat(74));

let forged = 0;
for (const [label, headers] of cases) {
  const res = await rawRequest(headers);
  const loc = locationOf(res);
  const hijacked = /evil\.example|169\.254\.169\.254|127\.0\.0\.1:9999/.test(loc);
  if (hijacked) forged++;
  console.log(`\n  ${label}`);
  console.log(`    sent     : ${headers.join(" | ")}`);
  console.log(`    status   : ${statusOf(res)}`);
  console.log(`    Location : ${loc}`);
  console.log(`    origin hijacked: ${hijacked ? "YES  <-- SSRF REACHABLE" : "no"}`);
}

console.log("\n" + "=".repeat(74));
console.log(
  forged === 0
    ? "RESULT: origin could NOT be steered by any header tried. SSRF not reachable here."
    : `RESULT: ${forged} case(s) steered the origin — SSRF reachable.`
);
console.log("=".repeat(74));
