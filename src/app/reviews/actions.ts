"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

export type AuthState = { error?: string; notice?: string };

export async function signIn(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "이메일과 비밀번호를 입력해 주세요." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };

  revalidatePath("/reviews");
  return {};
}

export async function signUp(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || password.length < 6)
    return { error: "이메일과 6자 이상 비밀번호가 필요합니다." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: "가입에 실패했습니다. 다른 이메일을 시도해 주세요." };

  revalidatePath("/reviews");
  return { notice: "가입되었습니다. 확인 메일이 필요한 설정이면 메일함을 확인해 주세요." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/reviews");
}
