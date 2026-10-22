import { timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { createServiceRoleClient } from "@/lib/supabase/server";

function isValidSecret(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = `Bearer ${secret}`;
  if (!header || header.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

export async function GET(request: NextRequest) {
  if (!isValidSecret(request.headers.get("authorization"))) {
    if (!process.env.CRON_SECRET) {
      return NextResponse.json({ error: "CONFIG_ERROR" }, { status: 500 });
    }
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const threshold = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("subscriptions")
    .update({ status: "needs_review" })
    .eq("status", "pending")
    .lt("created_at", threshold)
    .select("id");

  if (error) {
    console.error("reconcile-subscriptions: update başarısız", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }

  return NextResponse.json({ updated: data?.length ?? 0 });
}
