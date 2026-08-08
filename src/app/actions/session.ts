"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

export type LoginState = { error?: string; notice?: string };

/** 헤더 로그인 — 일반 회원(후기 열람) · 직원/관리자 공용 */
export async function headerSignIn(
  _prev: LoginState,
  form: FormData
): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "아이디와 비밀번호를 입력해 주세요." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "아이디 또는 비밀번호가 올바르지 않습니다." };

  revalidatePath("/", "layout");
  return {};
}

/** 헤더 회원가입 — 가입 즉시 로그인(이메일 확인 OFF일 때) */
export async function headerSignUp(
  _prev: LoginState,
  form: FormData
): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const name = String(form.get("name") ?? "").trim();

  if (!email || !password) return { error: "아이디와 비밀번호를 입력해 주세요." };
  if (password.length < 6) return { error: "비밀번호는 6자 이상이어야 합니다." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name: name || email.split("@")[0] } },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("already") || msg.includes("registered"))
      return { error: "이미 가입된 이메일입니다. 로그인해 주세요." };
    return { error: "가입에 실패했습니다. 다른 이메일을 시도해 주세요." };
  }

  // 이메일 확인이 켜져 있으면 세션이 없다 → 안내
  if (!data.session) {
    return { notice: "확인 메일을 보냈습니다. 메일함에서 인증 후 로그인해 주세요." };
  }

  revalidatePath("/", "layout");
  return {};
}

export async function headerSignOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
}
