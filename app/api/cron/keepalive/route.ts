/**
 * Upstash Redis keepalive.
 *
 * Upstash archives free-tier databases after a prolonged period with no
 * commands (its FAQ states a minimum of 14 days, with warning emails first).
 * This route issues one cheap command per run so the database always counts as
 * active. It touches a dedicated `zoomi:keepalive` key and never reads or
 * writes application data.
 *
 * Scheduled daily by the `crons` entry in vercel.json. Can also be called by
 * hand (or by any external scheduler) with the CRON_SECRET bearer token.
 */
import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KEEPALIVE_KEY = "zoomi:keepalive";

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function GET(request: Request) {
  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when the env var is
  // set. If it is not set, the route stays open (it exposes nothing sensitive).
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authorization = request.headers.get("authorization");
    if (authorization !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const redis = getRedis();
  if (!redis) {
    return NextResponse.json(
      { ok: false, reason: "redis-not-configured" },
      { status: 503 }
    );
  }

  const pingedAt = new Date().toISOString();
  try {
    await redis.set(KEEPALIVE_KEY, pingedAt);
    return NextResponse.json({ ok: true, pingedAt });
  } catch (error) {
    console.error("[cron/keepalive] Redis command failed", error);
    return NextResponse.json(
      {
        ok: false,
        reason: "redis-command-failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 502 }
    );
  }
}
