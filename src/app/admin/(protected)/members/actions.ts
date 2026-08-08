"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { getMe, isAdmin, logActivity } from "@/lib/auth";

export async function setRole(form: FormData) {
  const me = await getMe();
  if (!isAdmin(me)) throw new Error("관리자만 변경할 수 있습니다");

  const id = String(form.get("id"));
  const role = String(form.get("role"));
  if (!["admin", "staff", "member"].includes(role)) return;
  // 자기 자신의 관리자 권한을 스스로 내리는 사고 방지
  if (id === me!.id && role !== "admin") return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role, is_active: form.get("active") === "on" })
    .eq("id", id);

  if (!error) await logActivity("profile.role", "profiles", id, { role });
  revalidatePath("/admin/members");
}
