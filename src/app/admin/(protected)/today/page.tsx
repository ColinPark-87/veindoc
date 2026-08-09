import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { getMe } from "@/lib/auth";
import { ymd } from "@/lib/holidays";

export const dynamic = "force-dynamic";

/** 직원용 알림창.
 *  진료 보드(대시보드)가 '할 일'이라면 여기는 '지금까지 무슨 일이 있었나' 쪽이다.
 *  오늘 예약 · 내원 완료 · 내가 오늘 한 일을 각각 분리해서 본다. */

const ACTION_LABEL: Record<string, string> = {
  "auth.login": "로그인",
  "auth.logout": "로그아웃",
  "appointment.create": "예약 등록",
  "appointment.update": "예약 처리",
  "appointment.arrival": "내원 체크",
  "appointment.note": "진료 기록",
  "appointment.link": "환자 연결",
  "patient.memo": "환자 메모",
  "sms.queue": "문자 발송",
  "sms.bulk": "일괄 문자",
  "inquiry.resolve": "문의 처리",
  "holidays.refresh": "공휴일 갱신",
  "post.create": "글 작성",
  "post.publish": "글 공개",
  "review.hide": "후기 숨김",
  "profile.role": "권한 변경",
  "settings.update": "진료시간 변경",
};

const hhmm = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : "—";

export default async function TodayPage() {
  const me = await getMe();
  const supabase = await createClient();
  const today = ymd(new Date());

  const [apptRes, mineRes, smsRes, inqRes] = await Promise.all([
    supabase
      .from("appointments")
      .select("id,name,phone,patient_id,preferred_at,status,arrived_at,doctor,day_note")
      .gte("preferred_at", `${today}T00:00:00`)
      .lte("preferred_at", `${today}T23:59:59`)
      .neq("status", "cancelled")
      .order("preferred_at"),
    // RLS 상 직원은 자기 로그만 읽힌다(관리자는 전체) — '내가 한 일'에 딱 맞는다
    supabase
      .from("activity_logs")
      .select("id,action,entity,entity_id,created_at")
      .gte("created_at", `${today}T00:00:00`)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("sms_logs")
      .select("id,to_phone,template,status,created_at")
      .gte("created_at", `${today}T00:00:00`)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("inquiries")
      .select("id,name,phone,kind,created_at")
      .is("handled_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const appts = apptRes.data ?? [];
  const done = appts.filter((a) => a.arrived_at);
  const waiting = appts.filter((a) => !a.arrived_at);
  const mine = mineRes.data ?? [];
  const sms = smsRes.data ?? [];
  const inq = inqRes.data ?? [];

  return (
    <>
      <header className="adm-head">
        <div>
          <span className="adm-eyebrow">직원</span>
          <h1>알림</h1>
        </div>
        <span className="adm-period">
          {new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" })}
        </span>
      </header>

      <section className="adm-kpi">
        <Kpi label="오늘 예약" value={String(appts.length)} />
        <Kpi label="내원 완료" value={String(done.length)} sub="도착 확인됨" />
        <Kpi label="대기" value={String(waiting.length)} sub="아직 안 오심" tone={waiting.length ? "hot" : undefined} />
        <Kpi label="내가 한 일" value={String(mine.length)} sub="오늘 처리 건수" />
      </section>

      <div className="adm-grid2">
        <section className="adm-card">
          <div className="adm-card-head">
            <h2>대기 {waiting.length}</h2>
            <Link href={`/admin/calendar?d=${today}`}>캘린더 →</Link>
          </div>
          {waiting.length === 0 ? (
            <p className="adm-empty">대기 중인 예약이 없습니다.</p>
          ) : (
            <ul className="notif-list">
              {waiting.map((a) => (
                <li key={a.id}>
                  <span className="nf-time">{hhmm(a.preferred_at)}</span>
                  <b>{a.name}</b>
                  <a href={`tel:${a.phone}`}>{a.phone}</a>
                  {a.doctor && <em>{a.doctor}</em>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="adm-card">
          <h2>내원 완료 {done.length}</h2>
          {done.length === 0 ? (
            <p className="adm-empty">아직 내원 확인된 분이 없습니다.</p>
          ) : (
            <ul className="notif-list done">
              {done.map((a) => (
                <li key={a.id}>
                  <span className="nf-time">{hhmm(a.arrived_at)}</span>
                  <b>
                    {a.patient_id ? (
                      <Link href={`/admin/patients/${a.patient_id}`}>{a.name}</Link>
                    ) : (
                      a.name
                    )}
                  </b>
                  {a.doctor && <em>{a.doctor}</em>}
                  {a.day_note && <span className="adm-sub">{a.day_note}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="adm-card">
        <div className="adm-card-head">
          <h2>내가 오늘 한 일</h2>
          <span className="adm-sub">{me?.name || me?.email}</span>
        </div>
        {mine.length === 0 ? (
          <p className="adm-empty">오늘 기록된 작업이 없습니다.</p>
        ) : (
          <ul className="notif-list log">
            {mine.map((l) => (
              <li key={l.id}>
                <span className="nf-time">{hhmm(l.created_at)}</span>
                <b>{ACTION_LABEL[l.action] ?? l.action}</b>
                <span className="adm-sub">{l.entity ? `${l.entity} ${l.entity_id ?? ""}` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="adm-grid2">
        <section className="adm-card">
          <h2>오늘 나간 문자 {sms.length}</h2>
          {sms.length === 0 ? (
            <p className="adm-empty">발송 내역이 없습니다.</p>
          ) : (
            <ul className="notif-list">
              {sms.map((s) => (
                <li key={s.id}>
                  <span className="nf-time">{hhmm(s.created_at)}</span>
                  <b>{s.to_phone}</b>
                  <em>{s.template || "안내"}</em>
                  <span className={`adm-status ${s.status}`}>{s.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="adm-card">
          <div className="adm-card-head">
            <h2>미처리 문의 {inq.length}</h2>
            <Link href="/admin/inquiries">전체 →</Link>
          </div>
          {inq.length === 0 ? (
            <p className="adm-empty">미처리 문의가 없습니다.</p>
          ) : (
            <ul className="notif-list">
              {inq.map((q) => (
                <li key={q.id}>
                  <span className="nf-time">{hhmm(q.created_at)}</span>
                  <b>{q.name}</b>
                  <a href={`tel:${String(q.phone).replace(/[^0-9]/g, "")}`}>{q.phone}</a>
                  <em>{q.kind === "map_sms" ? "약도 문자" : "진료 상담"}</em>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
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
