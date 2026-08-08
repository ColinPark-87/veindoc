import { createClient } from "@/lib/supabase-server";
import { getMe, isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import Chart, { type Point } from "@/components/admin/Chart";

export const dynamic = "force-dynamic";

const PERIODS = [7, 14, 30, 90] as const;

const ACTION_LABEL: Record<string, string> = {
  "auth.login": "로그인",
  "auth.logout": "로그아웃",
  "appointment.create": "예약 등록",
  "appointment.update": "예약 처리",
  "appointment.arrival": "내원 체크",
  "appointment.note": "진료 기록",
  "patient.memo": "환자 메모",
  "sms.queue": "문자 발송",
  "holidays.refresh": "공휴일 갱신",
  "post.create": "글 작성",
  "post.publish": "글 공개",
  "post.unpublish": "글 숨김",
  "post.delete": "글 삭제",
  "review.hide": "후기 숨김",
  "review.show": "후기 공개",
  "review.delete": "후기 삭제",
  "profile.role": "권한 변경",
  "settings.update": "진료시간 변경",
};

type LogRow = {
  id: number;
  actor: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  created_at: string;
  profiles: { name?: string; email?: string } | null;
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; c?: string; who?: string }>;
}) {
  const me = await getMe();
  if (!isAdmin(me)) redirect("/admin");

  const sp = await searchParams;
  const DAYS = PERIODS.includes(Number(sp.d) as (typeof PERIODS)[number]) ? Number(sp.d) : 30;
  const kind = sp.c === "line" ? "line" : "bar";
  const who = sp.who ?? "";

  const supabase = await createClient();
  const since = new Date(Date.now() - DAYS * 864e5).toISOString();

  const [summary, logs] = await Promise.all([
    supabase.from("v_staff_activity").select("*"),
    supabase
      .from("activity_logs")
      .select("id,actor,action,entity,entity_id,created_at,profiles(name,email)")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(4000),
  ]);

  const staff = (summary.data ?? []) as Record<string, unknown>[];
  const all = ((logs.data ?? []) as unknown as LogRow[]);
  const rows = who ? all.filter((r) => r.actor === who) : all;

  const nameOf = (id: string | null) => {
    const s = staff.find((x) => String(x.id) === String(id));
    return (s?.name as string) || (s?.email as string) || "미상";
  };

  // ① 직원별 처리 건수 (기간 내) — 막대
  const perStaff = new Map<string, number>();
  all.forEach((r) => {
    if (!r.actor) return;
    perStaff.set(r.actor, (perStaff.get(r.actor) ?? 0) + 1);
  });
  const staffBars: Point[] = [...perStaff.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, n]) => ({ label: nameOf(id), value: n }));

  // ② 일별 추이 — 선택된 직원(없으면 전체)
  const byDay = new Map<string, number>();
  for (let i = DAYS - 1; i >= 0; i--) {
    byDay.set(new Date(Date.now() - i * 864e5).toISOString().slice(0, 10), 0);
  }
  rows.forEach((r) => {
    const d = r.created_at.slice(0, 10);
    if (byDay.has(d)) byDay.set(d, byDay.get(d)! + 1);
  });
  const daily: Point[] = [...byDay.entries()].map(([day, n]) => ({
    label: `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`,
    value: n,
  }));

  // ③ 작업 종류별 분해
  const byAction = new Map<string, number>();
  rows.forEach((r) => byAction.set(r.action, (byAction.get(r.action) ?? 0) + 1));
  const actions = [...byAction.entries()].sort((a, b) => b[1] - a[1]);
  const actionTop = actions[0]?.[1] ?? 1;

  const link = (o: Record<string, string | number>) =>
    `/admin/staff-activity?${new URLSearchParams(
      Object.fromEntries(
        Object.entries({ d: DAYS, c: kind, who, ...o }).map(([k, v]) => [k, String(v)])
      )
    )}`;

  return (
    <>
      <header className="adm-head">
        <div>
          <span className="adm-eyebrow">총괄 관리자</span>
          <h1>직원 실적</h1>
        </div>
        <nav className="adm-filter">
          {PERIODS.map((p) => (
            <a key={p} href={link({ d: p })} className={p === DAYS ? "on" : ""}>{p}일</a>
          ))}
        </nav>
      </header>

      <section className="adm-kpi">
        <Kpi label="총 처리" value={all.length.toLocaleString("ko-KR")} sub={`최근 ${DAYS}일`} />
        <Kpi label="활동 직원" value={String(perStaff.size)} sub={`등록 ${staff.length}명`} />
        <Kpi
          label="하루 평균"
          value={(Math.round((all.length / DAYS) * 10) / 10).toLocaleString("ko-KR")}
          sub="건/일"
        />
        <Kpi
          label="최다 작업"
          value={actions[0] ? (ACTION_LABEL[actions[0][0]] ?? actions[0][0]) : "—"}
          sub={actions[0] ? `${actions[0][1].toLocaleString("ko-KR")}건` : undefined}
        />
      </section>

      <section className="adm-card">
        <h2>직원별 처리 건수</h2>
        {staffBars.length === 0 ? (
          <p className="adm-empty">기간 내 활동이 없습니다.</p>
        ) : (
          <Chart data={staffBars} kind="bar" unit="건" color="#04A33F" tickEvery={1} />
        )}
      </section>

      <section className="adm-card">
        <div className="adm-card-head">
          <h2>일별 추이{who && ` — ${nameOf(who)}`}</h2>
          <nav className="adm-toggle">
            <a href={link({ c: "bar" })} className={kind === "bar" ? "on" : ""}>막대</a>
            <a href={link({ c: "line" })} className={kind === "line" ? "on" : ""}>꺾은선</a>
          </nav>
        </div>
        <Chart data={daily} kind={kind} unit="건" />
        <nav className="adm-filter">
          <a href={link({ who: "" })} className={!who ? "on" : ""}>전체</a>
          {staff.map((s) => (
            <a
              key={String(s.id)}
              href={link({ who: String(s.id) })}
              className={who === String(s.id) ? "on" : ""}
            >
              {(s.name as string) || (s.email as string)}
            </a>
          ))}
        </nav>
      </section>

      <div className="adm-grid2">
        <section className="adm-card">
          <h2>작업 종류</h2>
          {actions.length === 0 ? (
            <p className="adm-empty">기록 없음</p>
          ) : (
            <ul className="adm-bars">
              {actions.map(([k, v]) => (
                <li key={k}>
                  <span>{ACTION_LABEL[k] ?? k}</span>
                  <i style={{ width: `${(v / actionTop) * 100}%` }} />
                  <b>{v.toLocaleString("ko-KR")}</b>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="adm-card">
          <h2>누적 실적</h2>
          <table className="adm-table">
            <thead>
              <tr><th>이름</th><th>권한</th><th>총 처리</th><th>최근 7일</th><th>마지막 활동</th></tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={String(s.id)}>
                  <td>{(s.name as string) || (s.email as string)}</td>
                  <td>
                    <span className={`adm-tag ${s.role === "admin" ? "on" : ""}`}>
                      {s.role === "admin" ? "관리자" : "직원"}
                    </span>
                  </td>
                  <td>{Number(s.actions ?? 0).toLocaleString("ko-KR")}</td>
                  <td>{Number(s.actions_7d ?? 0).toLocaleString("ko-KR")}</td>
                  <td className="nowrap">
                    {s.last_at ? new Date(String(s.last_at)).toLocaleString("ko-KR") : "—"}
                  </td>
                </tr>
              ))}
              {staff.length === 0 && (
                <tr><td colSpan={5}><p className="adm-empty">등록된 직원이 없습니다.</p></td></tr>
              )}
            </tbody>
          </table>
        </section>
      </div>

      <section className="adm-card">
        <h2>최근 활동 로그</h2>
        <table className="adm-table">
          <thead><tr><th>시각</th><th>담당</th><th>작업</th><th>대상</th></tr></thead>
          <tbody>
            {rows.slice(0, 120).map((r) => (
              <tr key={r.id}>
                <td className="nowrap">{new Date(r.created_at).toLocaleString("ko-KR")}</td>
                <td>{r.profiles?.name || r.profiles?.email || nameOf(r.actor)}</td>
                <td>{ACTION_LABEL[r.action] ?? r.action}</td>
                <td className="adm-sub">{r.entity ? `${r.entity} ${r.entity_id ?? ""}` : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={4}><p className="adm-empty">아직 기록된 활동이 없습니다.</p></td></tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="adm-kpi-item">
      <span>{label}</span>
      <b>{value}</b>
      {sub && <i>{sub}</i>}
    </div>
  );
}
