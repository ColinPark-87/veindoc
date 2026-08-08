"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { getMe, isStaff, logActivity } from "@/lib/auth";

export async function updateAppointment(form: FormData) {
  const me = await getMe();
  if (!isStaff(me)) throw new Error("권한 없음");

  const id = String(form.get("id"));
  const status = String(form.get("status"));
  const memo = String(form.get("memo") ?? "");

  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .update({ status, memo, assignee: me!.id, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (!error) await logActivity("appointment.update", "appointments", id, { status });
  revalidatePath("/admin/appointments");
}
