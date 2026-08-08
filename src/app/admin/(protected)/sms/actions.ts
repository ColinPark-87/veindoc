"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { getMe, isStaff, logActivity } from "@/lib/auth";

export async function queueSms(form: FormData) {
  const me = await getMe();
  if (!isStaff(me)) throw new Error("권한 없음");

  const phone = String(form.get("phone") ?? "").replace(/[^0-9]/g, "");
  const body = String(form.get("body") ?? "").trim();
  if (phone.length < 9 || !body) return;

  const supabase = await createClient();
  // TODO: 실제 문자 API(알리고/NHN 등) 연동 지점. 지금은 queued 로만 적재.
  const { data, error } = await supabase
    .from("sms_logs")
    .insert({
      to_phone: phone,
      body,
      template: String(form.get("template") ?? ""),
      branch: String(form.get("branch") ?? "대전"),
      status: "queued",
      sent_by: me!.id,
    })
    .select("id")
    .single();

  if (!error) await logActivity("sms.queue", "sms_logs", data?.id, { phone });
  revalidatePath("/admin/sms");
}
