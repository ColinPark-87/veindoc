"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { getMe, isAdmin, logActivity } from "@/lib/auth";

export async function saveHours(form: FormData) {
  const me = await getMe();
  if (!isAdmin(me)) throw new Error("관리자만 변경할 수 있습니다");

  const branch = String(form.get("branch"));
  const payload = {
    weekday: { open: String(form.get("w_open")), close: String(form.get("w_close")) },
    saturday: { open: String(form.get("s_open")), close: String(form.get("s_close")) },
    lunch: { start: String(form.get("l_start")), end: String(form.get("l_end")) },
    notice: String(form.get("notice") ?? ""),
    updated_at: new Date().toISOString(),
  };

  const supabase = await createClient();
  const { error } = await supabase.from("clinic_settings").update(payload).eq("branch", branch);
  if (!error) await logActivity("settings.update", "clinic_settings", branch);
  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
}
