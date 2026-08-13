import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@prisma/client";

/* One Prisma client, on the pooled connection.
 *
 * The app used to run on DIRECT_URL — Supabase's *session* pooler on port 5432,
 * which holds a Postgres backend open for the whole life of each client. That is
 * the right connection for migrations and for one-off scripts, and the wrong one
 * for a web server: under any real traffic the project runs out of connections
 * and new requests fail with "too many clients". DATABASE_URL is the transaction
 * pooler on 6543, which hands a backend back after every statement — it is what
 * `.env` provides it for, and what nothing was using.
 *
 * `prisma.config.ts` still points the CLI at DIRECT_URL, which is correct:
 * migrations need a session that outlives a single statement.
 */

const globalForPrisma = global as unknown as { prisma: PrismaClient };

/**
 * How many Postgres connections this process may hold at once.
 *
 * The transaction pooler does the real multiplexing, so this only needs to cover
 * the queries one instance runs concurrently — node-postgres defaults to 10,
 * which is generous for a single trainee's dashboard and ruinous when a platform
 * runs twenty instances of it. Serverless deployments should set this to 1.
 */
const POOL_MAX = Number(process.env.DATABASE_POOL_MAX ?? 5);

function connectionString(): string {
  const pooled = process.env.DATABASE_URL;
  if (pooled) return pooled;

  /* Falling back rather than refusing: an environment that only ever set
     DIRECT_URL still works, which is how this app has been running. It is worth
     a line in the log, not an outage. */
  const direct = process.env.DIRECT_URL;
  if (direct) {
    console.warn(
      "[db] DATABASE_URL is not set; falling back to DIRECT_URL. " +
        "That is the session pooler — set DATABASE_URL to the transaction pooler for production."
    );
    return direct;
  }

  throw new Error("Neither DATABASE_URL nor DIRECT_URL is set.");
}

/**
 * What Prisma writes to the log.
 *
 * `["query"]` was on unconditionally. Every statement and its parameters —
 * password hashes, phone numbers, the whole intake blob — went to stdout, which
 * on a hosted platform means into a log aggregator that nobody has classified as
 * holding personal data. Production keeps errors only; the detail stays in
 * development, where the data is not real and the output is the point.
 */
function logLevels(): Prisma.LogLevel[] {
  return process.env.NODE_ENV === "production"
    ? ["error"]
    : ["query", "warn", "error"];
}

const createPrismaClient = () => {
  const pool = new Pool({
    connectionString: connectionString(),
    max: Number.isFinite(POOL_MAX) && POOL_MAX > 0 ? POOL_MAX : 5,
    /* Hand idle connections back to the pooler rather than sitting on them. */
    idleTimeoutMillis: 10_000,
    /* Fail a request that cannot get a connection instead of hanging on it. */
    connectionTimeoutMillis: 10_000,
  });

  return new PrismaClient({ adapter: new PrismaPg(pool), log: logLevels() });
};

export const prisma = globalForPrisma.prisma || createPrismaClient();

/* In development the module is re-evaluated on every hot reload, and each
   evaluation would otherwise open a new pool that the last one never closed. */
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
