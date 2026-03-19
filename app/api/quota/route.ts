import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getUserQuota } from "@/lib/quota";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const quota = await getUserQuota(supabase, user.id);
  return Response.json({ quota });
}
