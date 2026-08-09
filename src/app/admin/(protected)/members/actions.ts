"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { getMe, isAdmin, logActivity } from "@/lib/auth";
import { guard } from "@/lib/notice";

const ROLES = ["admin", "staff", "member"] as const;

export async function setRole(form: FormData) {
  await guard(async () => {
    const me = await getMe();
    if (!isAdmin(me)) throw new Error("관리자만 변경할 수 있습니다");

    const id = String(form.get("id"));
    const role = String(form.get("role"));
    const active = form.get("active") === "on";
    const branch = String(form.get("branch") ?? "").trim();
    if (!ROLES.includes(role as (typeof ROLES)[number])) return;

    // 자기 자신의 관리자 권한을 스스로 내리는 사고 방지
    if (id === me!.id && role !== "admin") return;

    const supabase = await createClient();

    // 마지막 관리자를 내리거나 비활성화하면 아무도 못 들어온다. 그 전에 막는다.
    const losingAdmin = role !== "admin" || !active;
    if (losingAdmin) {
      const { data: admins } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "admin")
        .eq("is_active", true);
      const remaining = (admins ?? []).filter((a) => a.id !== id).length;
      if (remaining === 0) throw new Error("마지막 관리자입니다. 다른 관리자를 먼저 지정하세요.");
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        role,
        is_active: active,
        ...(branch ? { branch } : {}),
      })
      .eq("id", id);
    if (error) throw new Error(`권한 변경 실패: ${error.message}`);

    await logActivity("profile.role", "profiles", id, { role, active, branch });
    revalidatePath("/admin/members");
  });
}

/** 목록에서 한 번에 올리기 — 가입 직후 승인용 */
export async function promote(form: FormData) {
  await guard(async () => {
    const me = await getMe();
    if (!isAdmin(me)) throw new Error("관리자만 변경할 수 있습니다");

    const id = String(form.get("id"));
    const role = String(form.get("role"));
    if (role !== "staff" && role !== "admin") return;

    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ role, is_active: true })
      .eq("id", id);
    if (error) throw new Error(`권한 부여 실패: ${error.message}`);

    await logActivity("profile.role", "profiles", id, { role, via: "promote" });
    revalidatePath("/admin/members");
  });
}
