"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { getMe, isStaff, isAdmin, logActivity } from "@/lib/auth";
import { guard } from "@/lib/notice";

/** 비공개(스팸) 처리 토글 — is_secret 을 노출 스위치로 사용 */
export async function toggleReview(form: FormData) {
  await guard(async () => {
    const me = await getMe();
    if (!isStaff(me)) throw new Error("권한 없음");
    const id = String(form.get("id"));
    const hide = form.get("hide") === "1";

    const supabase = await createClient();
    const { error } = await supabase.from("reviews").update({ is_secret: hide }).eq("id", id);
    if (!error) await logActivity(hide ? "review.hide" : "review.show", "reviews", id);
    revalidatePath("/admin/reviews");
  });
}

export async function deleteReview(form: FormData) {
  await guard(async () => {
    const me = await getMe();
    if (!isAdmin(me)) throw new Error("관리자만 삭제할 수 있습니다");
    const id = String(form.get("id"));
    const supabase = await createClient();
    const { error } = await supabase.from("reviews").delete().eq("id", id);
    if (!error) await logActivity("review.delete", "reviews", id);
    revalidatePath("/admin/reviews");
  });
}
