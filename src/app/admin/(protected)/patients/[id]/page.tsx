import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import {
  createVisit,
  savePatientMemo,
  saveVisitNote,
  sendPatientSms,
  toggleArrival,
} from "../../care-actions";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  new: "신규",
  confirmed: "확정",
  done: "완료",
  cancelled: "취소",
  noshow: "노쇼",
};

const fmtPhone = (p: string) =>
  p.length === 11 ? `${p.slice(0, 3)}-${p.slice(3, 7)}-${p.slice(7)}` : p;

const dt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" }) : "—";

const localInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default async function PatientDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: patient } = await supabase
    .from("patients")
    .select("id,name,phone,branch,doctor,memo,first_seen,last_seen")
    .eq("id", id)
    .maybeSingle();
  if (!patient) notFound();

  const [visitsRes, smsRes, sameNameRes] = await Promise.all([
    supabase
      .from("appointments")
      .select("id,preferred_at,status,arrived_at,doctor,day_note,next_at,memo,branch,phone,name")
      .eq("patient_id", id)
      .order("preferred_at", { ascending: false, nullsFirst: false }),
    supabase
      .from("sms_logs")
      .select("id,body,status,created_at,template")
      .eq("to_phone", patient.phone)
      .order("created_at", { ascending: false })
      .limit(50),
    // 동명이인 — 이름은 같은데 전화번호가 다른 사람
    supabase.from("patients").select("id,phone").eq("name", patient.name).neq("id", id),
  ]);

  const visits = visitsRes.data ?? [];
  const sms = smsRes.data ?? [];
  const twins = sameNameRes.data ?? [];
  const visited = visits.filter((v) => v.arrived_at).length;
  const nextUp = visits
    .map((v) => v.next_at)
    .filter((x): x is string => !!x && new Date(x) > new Date())
    .sort()[0];

  return (
    <>
      <header className="adm-head">
        <div>
          <span className="adm-eyebrow">
            <Link href="/admin/patients">환자 관리</Link> · 상세
          </span>
          <h1>
            {patient.name}
            <a className="pt-tel" href={`tel:${patient.phone}`}>{fmtPhone(patient.phone)}</a>
          </h1>
        </div>
      </header>

      {twins.length > 0 && (
        <p className="adm-msg warn">
          이름이 같은 환자가 {twins.length}명 더 있습니다. 전화번호로 구분하세요 —{" "}
          {twins.map((t, i) => (
            <span key={t.id}>
              {i > 0 && ", "}
              <Link href={`/admin/patients/${t.id}`}>{fmtPhone(String(t.phone))}</Link>
            </span>
          ))}
        </p>
      )}

      <section className="adm-kpi">
        <Kpi label="총 진료" value={String(visits.length)} sub={`내원 ${visited}회`} />
        <Kpi label="첫 진료" value={patient.first_seen ? new Date(patient.first_seen).toLocaleDateString("ko-KR") : "—"} />
        <Kpi label="최근 진료" value={patient.last_seen ? new Date(patient.last_seen).toLocaleDateString("ko-KR") : "—"} />
        <Kpi label="다음 진료" value={nextUp ? dt(nextUp) : "미정"} tone={nextUp ? "hot" : undefined} />
      </section>

      <div className="adm-grid2">
        <section className="adm-card">
          <h2>환자 정보</h2>
          <form action={savePatientMemo} className="cv-form">
            <input type="hidden" name="id" value={patient.id} />
            <label>
              <span>주치의</span>
              <input name="doctor" defaultValue={patient.doctor ?? ""} placeholder="담당 선생님" />
            </label>
            <label className="grow">
              <span>상시 메모</span>
              <input name="memo" defaultValue={patient.memo ?? ""} placeholder="알레르기·기저질환 등" />
            </label>
            <button type="submit">저장</button>
          </form>
        </section>

        <section className="adm-card">
          <h2>문자 보내기</h2>
          <form action={sendPatientSms} className="cv-sms">
            <input type="hidden" name="phone" value={patient.phone} />
            <input type="hidden" name="branch" value={patient.branch ?? "대전"} />
            <input type="hidden" name="template" value="진료안내" />
            <input
              name="body"
              placeholder="문자 내용"
              defaultValue={`${patient.name}님, 삼성흉부외과 대전입니다.`}
            />
            <button type="submit">보내기</button>
          </form>
          <p className="adm-sub">발송 이력 {sms.length}건 · 실제 전송은 문자 API 연동 후 처리됩니다.</p>
        </section>
      </div>

      <section className="adm-card">
        <div className="adm-card-head">
          <h2>진료 이력</h2>
          <span className="adm-sub">최근순 · 같은 환자의 기록이 이어서 쌓입니다</span>
        </div>

        {visits.length === 0 ? (
          <p className="adm-empty">진료 기록이 없습니다.</p>
        ) : (
          <ul className="cal-visits">
            {visits.map((v) => (
              <li key={v.id} className={v.arrived_at ? "in" : ""}>
                <div className="cv-top">
                  <span className="cv-time">{dt(v.preferred_at)}</span>
                  <span className={`adm-status ${v.status}`}>{STATUS[v.status] ?? v.status}</span>
                  {v.doctor && <b className="cv-name">{v.doctor}</b>}
                  <form action={toggleArrival} className="cv-check">
                    <input type="hidden" name="id" value={v.id} />
                    <input type="hidden" name="arrived" value={v.arrived_at ? "0" : "1"} />
                    <button type="submit" className={v.arrived_at ? "on" : ""}>
                      {v.arrived_at ? "내원함" : "내원 체크"}
                    </button>
                  </form>
                </div>

                <form action={saveVisitNote} className="cv-form">
                  <input type="hidden" name="id" value={v.id} />
                  <input type="hidden" name="patient_id" value={patient.id} />
                  <label>
                    <span>주치의</span>
                    <input name="doctor" defaultValue={v.doctor ?? ""} />
                  </label>
                  <label className="grow">
                    <span>당일 특이 기록</span>
                    <input name="day_note" defaultValue={v.day_note ?? ""} />
                  </label>
                  <label>
                    <span>다음 진료</span>
                    <input type="datetime-local" name="next_at" defaultValue={localInput(v.next_at)} />
                  </label>
                  <button type="submit">저장</button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <details className="cal-add">
          <summary>진료 예약 추가</summary>
          <form action={createVisit} className="cv-form">
            <input type="hidden" name="name" value={patient.name} />
            <input type="hidden" name="phone" value={patient.phone} />
            <input type="hidden" name="branch" value={patient.branch ?? "대전"} />
            <label>
              <span>일시</span>
              <input type="datetime-local" name="preferred_at" required />
            </label>
            <label>
              <span>주치의</span>
              <input name="doctor" defaultValue={patient.doctor ?? ""} />
            </label>
            <label className="grow">
              <span>메모</span>
              <input name="memo" placeholder="접수 메모" />
            </label>
            <button type="submit">등록</button>
          </form>
        </details>
      </section>

      {sms.length > 0 && (
        <section className="adm-card">
          <h2>문자 이력</h2>
          <table className="adm-table">
            <thead><tr><th>시각</th><th>구분</th><th>내용</th><th>상태</th></tr></thead>
            <tbody>
              {sms.map((s) => (
                <tr key={s.id}>
                  <td className="nowrap">{dt(s.created_at)}</td>
                  <td>{s.template || "—"}</td>
                  <td>{s.body}</td>
                  <td><span className={`adm-status ${s.status}`}>{s.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "hot" }) {
  return (
    <div className={`adm-kpi-item${tone === "hot" ? " hot" : ""}`}>
      <span>{label}</span>
      <b>{value}</b>
      {sub && <i>{sub}</i>}
    </div>
  );
}
