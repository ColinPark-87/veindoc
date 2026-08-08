import { createClient } from "@/lib/supabase-server";

export type Role = "admin" | "staff" | "member" | "anon";

export type Me = {
  id: string;
  email: string;
  name: string;
  role: Role;
  branch: string;
};

/** 현재 로그인 사용자 + 권한. 비로그인이면 null */
export async function getMe(): Promise<Me | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id,email,name,role,branch,is_active")
    .eq("id", user.id)
    .single();

  if (!data || data.is_active === false) return null;

  return {
    id: data.id,
    email: data.email ?? user.email ?? "",
    name: data.name ?? "",
    role: (data.role ?? "member") as Role,
    branch: data.branch ?? "대전",
  };
}

export const isStaff = (m: Me | null) => m?.role === "admin" || m?.role === "staff";
export const isAdmin = (m: Me | null) => m?.role === "admin";

/** 직원 업무 로그 — 총괄 대시보드 집계용 */
export async function logActivity(
  action: string,
  entity?: string,
  entityId?: string | number,
  detail: Record<string, unknown> = {}
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("activity_logs").insert({
    actor: user.id,
    action,
    entity: entity ?? null,
    entity_id: entityId != null ? String(entityId) : null,
    detail,
  });
}
