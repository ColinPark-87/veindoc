"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { getMe, isStaff, isAdmin, logActivity } from "@/lib/auth";
import { fetchKasiYear, fixedHolidays, holidayYears } from "@/lib/holidays";

const onlyDigits = (v: unknown) => String(v ?? "").replace(/[^0-9]/g, "");

/** 화면 여러 곳이 같은 데이터를 보고 있어 한 번에 갱신한다 */
function revalidateCare() {
  revalidatePath("/admin/calendar");
  revalidatePath("/admin/patients");
  revalidatePath("/admin/appointments");
}

/** 로컬 datetime-local 문자열 → ISO. 빈 값은 null */
function toISO(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// ═══════════════════════════════════════════
// 공휴일 새로고침 — 네이버/관보가 갱신되면 눌러서 다시 끌어온다
// ═══════════════════════════════════════════
export async function refreshHolidays() {
  const me = await getMe();
  if (!isAdmin(me)) throw new Error("권한 없음");

  const supabase = await createClient();
  const years = holidayYears();
  const key = process.env.HOLIDAY_API_KEY ?? "";

  const rows: Awaited<ReturnType<typeof fixedHolidays>> = [];
  const failed: number[] = [];

  for (const y of years) {
    const got = key ? await fetchKasiYear(y, key) : null;
    if (got === null) {
      // 원천을 못 읽었으면 날짜 고정 공휴일만이라도 채운다(음력분은 비워 둔다)
      failed.push(y);
      rows.push(...fixedHolidays(y));
    } else {
      rows.push(...got);
    }
  }

  // 같은 날짜가 두 번 오면 원천(kasi) 쪽을 남긴다
  const merged = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    const prev = merged.get(r.day);
    if (!prev || (prev.source === "fixed" && r.source === "kasi")) merged.set(r.day, r);
  }
  const list = [...merged.values()];

  const { error } = await supabase.from("holidays").upsert(
    list.map((r) => ({ ...r, synced_at: new Date().toISOString() })),
    { onConflict: "day" }
  );
  if (error) throw new Error(`공휴일 저장 실패: ${error.message}`);

  await supabase.from("holiday_syncs").insert({
    years,
    fetched: rows.length,
    upserted: list.length,
    failed,
    source: key ? "kasi" : "fixed",
    actor: me!.id,
  });
  await logActivity("holidays.refresh", "holidays", undefined, {
    years: years.length,
    upserted: list.length,
    failed,
  });

  revalidatePath("/admin/calendar");
}

// ═══════════════════════════════════════════
// 환자 · 진료
// ═══════════════════════════════════════════

/** 예약 1건 생성. 이름+전화로 환자를 찾거나 만들어 붙인다(= 누적의 기준) */
export async function createVisit(form: FormData) {
  const me = await getMe();
  if (!isStaff(me)) throw new Error("권한 없음");

  const name = String(form.get("name") ?? "").trim();
  const phone = onlyDigits(form.get("phone"));
  const at = toISO(form.get("preferred_at"));
  if (!name || !phone) return;

  const supabase = await createClient();
  const { data: pid, error: pe } = await supabase.rpc("upsert_patient", {
    p_name: name,
    p_phone: phone,
    p_branch: String(form.get("branch") ?? "대전"),
    p_doctor: String(form.get("doctor") ?? ""),
  });
  if (pe) throw new Error(`환자 등록 실패: ${pe.message}`);

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      name,
      phone,
      patient_id: pid,
      branch: String(form.get("branch") ?? "대전"),
      preferred_at: at,
      doctor: String(form.get("doctor") ?? ""),
      memo: String(form.get("memo") ?? ""),
      status: "confirmed",
      source: "phone",
      assignee: me!.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(`예약 생성 실패: ${error.message}`);

  await logActivity("appointment.create", "appointments", data?.id, { name });
  revalidateCare();
}

/** 내원 체크 — arrived_at 이 원천(트리거가 status 를 맞춘다) */
export async function toggleArrival(form: FormData) {
  const me = await getMe();
  if (!isStaff(me)) throw new Error("권한 없음");

  const id = String(form.get("id"));
  const arrived = String(form.get("arrived")) === "1";

  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .update({
      arrived_at: arrived ? new Date().toISOString() : null,
      ...(arrived ? {} : { status: "confirmed" }),
      assignee: me!.id,
    })
    .eq("id", id);
  if (error) throw new Error(`내원 체크 실패: ${error.message}`);

  await logActivity("appointment.arrival", "appointments", id, { arrived });
  revalidateCare();
}

/** 당일 특이기록 · 주치의 · 다음 진료 */
export async function saveVisitNote(form: FormData) {
  const me = await getMe();
  if (!isStaff(me)) throw new Error("권한 없음");

  const id = String(form.get("id"));
  const doctor = String(form.get("doctor") ?? "").trim();

  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .update({
      day_note: String(form.get("day_note") ?? ""),
      doctor,
      next_at: toISO(form.get("next_at")),
      assignee: me!.id,
    })
    .eq("id", id);
  if (error) throw new Error(`기록 저장 실패: ${error.message}`);

  // 환자의 '주로 보는 주치의'도 최근 값으로 따라가게 한다
  const pid = String(form.get("patient_id") ?? "");
  if (pid && doctor) await supabase.from("patients").update({ doctor }).eq("id", pid);

  await logActivity("appointment.note", "appointments", id, { doctor });
  revalidateCare();
}

/** 환자 단위 상시 메모 */
export async function savePatientMemo(form: FormData) {
  const me = await getMe();
  if (!isStaff(me)) throw new Error("권한 없음");

  const id = String(form.get("id"));
  const supabase = await createClient();
  const { error } = await supabase
    .from("patients")
    .update({
      memo: String(form.get("memo") ?? ""),
      doctor: String(form.get("doctor") ?? ""),
    })
    .eq("id", id);
  if (error) throw new Error(`저장 실패: ${error.message}`);

  await logActivity("patient.memo", "patients", id);
  revalidateCare();
}

/** 환자 전화번호로 문자 — 실제 발송은 문자 API 연동 지점(sms/actions.ts 와 같은 큐) */
export async function sendPatientSms(form: FormData) {
  const me = await getMe();
  if (!isStaff(me)) throw new Error("권한 없음");

  const phone = onlyDigits(form.get("phone"));
  const body = String(form.get("body") ?? "").trim();
  if (phone.length < 9 || !body) return;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sms_logs")
    .insert({
      to_phone: phone,
      body,
      template: String(form.get("template") ?? "진료안내"),
      branch: String(form.get("branch") ?? "대전"),
      status: "queued",
      sent_by: me!.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(`문자 적재 실패: ${error.message}`);

  await logActivity("sms.queue", "sms_logs", data?.id, { phone });
  revalidateCare();
}
