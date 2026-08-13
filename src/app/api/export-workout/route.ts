import { NextResponse, type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const targetUrl = new URL(`/export-workout?${url.searchParams.toString()}`, req.url);
  return NextResponse.redirect(targetUrl, 307);
}
