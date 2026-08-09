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

// ═══════════════════════════════════════════
// 동시 수정 잠금
// ═══════════════════════════════════════════

/** 수정 시작 — 남이 잡고 있으면 그 사람 이름을 담아 거절한다 */
export async function startEdit(form: FormData) {
  const me = await getMe();
  if (!isStaff(me)) throw new Error("권한 없음");

  const id = String(form.get("id"));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("acquire_lock", {
    p_entity: "appointments",
    p_id: id,
    p_minutes: 3,
  });
  if (error) throw new Error(`수정 시작 실패: ${error.message}`);

  const row = Array.isArray(data) ? data[0] : data;
  if (row && row.ok === false) {
    throw new Error(`${row.holder}님이 수정 중입니다. 잠시 후 다시 시도해 주세요.`);
  }
  revalidateCare();
}

export async function endEdit(form: FormData) {
  const me = await getMe();
  if (!isStaff(me)) throw new Error("권한 없음");

  const supabase = await createClient();
  await supabase.rpc("release_lock", { p_entity: "appointments", p_id: String(form.get("id")) });
  revalidateCare();
}

/** 저장 직전 확인. 잠금이 만료된 틈을 대비해 updated_at 도 함께 본다. */
async function assertWritable(id: string, expected?: string | null) {
  const supabase = await createClient();

  const { data: ok } = await supabase.rpc("lock_is_mine", {
    p_entity: "appointments",
    p_id: id,
  });
  if (ok === false) {
    const { data: l } = await supabase
      .from("edit_locks")
      .select("actor_name")
      .eq("entity", "appointments")
      .eq("entity_id", id)
      .maybeSingle();
    throw new Error(`${l?.actor_name ?? "다른 직원"}님이 수정 중입니다. 저장하지 않았습니다.`);
  }

  if (expected) {
    const { data: cur } = await supabase
      .from("appointments")
      .select("updated_at")
      .eq("id", id)
      .maybeSingle();
    if (cur?.updated_at && cur.updated_at !== expected) {
      throw new Error(
        "이 사이에 다른 사람이 먼저 저장했습니다. 새로고침해서 최신 내용을 확인한 뒤 다시 입력해 주세요."
      );
    }
  }
}

/** 내원 체크 — arrived_at 이 원천(트리거가 status 를 맞춘다) */
export async function toggleArrival(form: FormData) {
  const me = await getMe();
  if (!isStaff(me)) throw new Error("권한 없음");

  const id = String(form.get("id"));
  const arrived = String(form.get("arrived")) === "1";
  await assertWritable(id);

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
  await assertWritable(id, String(form.get("expected_at") ?? "") || null);

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

  // 저장했으면 잠금은 놓는다 — 붙잡고 있을 이유가 없다
  await supabase.rpc("release_lock", { p_entity: "appointments", p_id: id });

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

/** 이미 있는 예약을 환자에 붙인다 — 예약 관리에서 들어온 건은 patient_id 가 비어 있다 */
export async function linkPatient(form: FormData) {
  const me = await getMe();
  if (!isStaff(me)) throw new Error("권한 없음");

  const id = String(form.get("id"));
  const name = String(form.get("name") ?? "").trim();
  const phone = onlyDigits(form.get("phone"));
  if (!name || !phone) throw new Error("이름과 전화번호가 있어야 환자로 연결할 수 있습니다");

  const supabase = await createClient();
  const { data: pid, error: pe } = await supabase.rpc("upsert_patient", {
    p_name: name,
    p_phone: phone,
    p_branch: String(form.get("branch") ?? "대전"),
    p_doctor: String(form.get("doctor") ?? ""),
  });
  if (pe) throw new Error(`환자 연결 실패: ${pe.message}`);

  const { error } = await supabase
    .from("appointments")
    .update({ patient_id: pid })
    .eq("id", id);
  if (error) throw new Error(`예약 갱신 실패: ${error.message}`);

  await logActivity("appointment.link", "appointments", id, { name });
  revalidateCare();
}

/** 오늘 아직 안 온 예약자 전원에게 안내 문자 — 매일 아침 한 번 누르는 용도 */
export async function sendTodayReminders(form: FormData) {
  const me = await getMe();
  if (!isStaff(me)) throw new Error("권한 없음");

  const day = String(form.get("day") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("날짜가 올바르지 않습니다");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("id,name,phone,branch,preferred_at,arrived_at,status")
    .gte("preferred_at", `${day}T00:00:00`)
    .lte("preferred_at", `${day}T23:59:59`)
    .is("arrived_at", null)
    .neq("status", "cancelled");
  if (error) throw new Error(`대상 조회 실패: ${error.message}`);

  const targets = (data ?? []).filter((a) => onlyDigits(a.phone).length >= 9);
  if (targets.length === 0) return;

  const rows = targets.map((a) => {
    const t = a.preferred_at
      ? new Date(a.preferred_at).toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";
    return {
      to_phone: onlyDigits(a.phone),
      body: `${a.name}님, 오늘 ${t} 진료 예약 안내드립니다. 삼성흉부외과 대전 042-471-3075`,
      template: "당일리마인드",
      branch: a.branch ?? "대전",
      status: "queued",
      sent_by: me!.id,
    };
  });

  const { error: ie } = await supabase.from("sms_logs").insert(rows);
  if (ie) throw new Error(`문자 적재 실패: ${ie.message}`);

  await logActivity("sms.bulk", "sms_logs", undefined, { day, count: rows.length });
  revalidateCare();
}

/** 상담·약도 요청 처리 표시 */
export async function resolveInquiry(form: FormData) {
  const me = await getMe();
  if (!isStaff(me)) throw new Error("권한 없음");

  const id = String(form.get("id"));
  const supabase = await createClient();
  const { error } = await supabase
    .from("inquiries")
    .update({ handled_at: new Date().toISOString(), handled_by: me!.id })
    .eq("id", id);
  if (error) throw new Error(`처리 실패: ${error.message}`);

  await logActivity("inquiry.resolve", "inquiries", id);
  revalidatePath("/admin/inquiries");
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
