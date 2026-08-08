"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { logActivity } from "@/lib/auth";

export type LoginState = { error?: string };

export async function signInAdmin(
  _prev: LoginState,
  form: FormData
): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "아이디와 비밀번호를 입력해 주세요." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: "아이디 또는 비밀번호가 올바르지 않습니다." };

  // 권한 확인 — 직원 이상만 관리자 영역 진입
  const { data: prof } = await supabase
    .from("profiles")
    .select("role,is_active")
    .eq("id", data.user.id)
    .single();

  if (!prof || prof.is_active === false || !["admin", "staff"].includes(prof.role)) {
    await supabase.auth.signOut();
    return { error: "관리자 권한이 없는 계정입니다." };
  }

  await logActivity("auth.login");
  redirect("/admin");
}

export async function signOutAdmin() {
  const supabase = await createClient();
  await logActivity("auth.logout");
  await supabase.auth.signOut();
  revalidatePath("/admin", "layout");
  redirect("/admin/login");
}
