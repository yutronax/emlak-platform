import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  // Uygulama seviyesinde sahiplik kontrolü (RLS'e ek olarak): id VE agent_id birlikte.
  // Yetkisiz ile var olmayan kayıt aynı yanıtı alır (bilgi sızıntısı yok).
  const { data: subscription, error } = await supabase
    .from("subscriptions")
    .select("plan_id, status, current_period_end")
    .eq("id", id)
    .eq("agent_id", auth.user.id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
  if (!subscription) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json(
    {
      plan_id: subscription.plan_id,
      status: subscription.status,
      current_period_end: subscription.current_period_end,
    },
    { status: 200 },
  );
}
