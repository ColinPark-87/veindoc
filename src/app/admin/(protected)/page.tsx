import { getMe, isAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import Link from "next/link";
import Chart, { type Point } from "@/components/admin/Chart";

export const dynamic = "force-dynamic";

const PERIODS = [7, 14, 30, 90] as const;

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; c?: string }>;
}) {
  const sp = await searchParams;
  const DAYS = PERIODS.includes(Number(sp.d) as (typeof PERIODS)[number])
    ? Number(sp.d)
    : 14;
  const kind = sp.c === "bar" ? "bar" : "line";

  const me = await getMe();
  const supabase = await createClient();
  const since = new Date(Date.now() - DAYS * 864e5).toISOString();

  // 직원은 자기 업무 홈으로
  if (!isAdmin(me)) return <StaffHome />;

  const [pv, clicks, appts, reviews, staff, posts] = await Promise.all([
    supabase.from("page_views").select("path,device,session_id,created_at").gte("created_at", since),
    supabase.from("click_events").select("target,created_at").gte("created_at", since),
    supabase.from("appointments").select("id,status,created_at").gte("created_at", since),
    supabase.from("reviews").select("id", { count: "exact", head: true }),
    supabase.from("v_staff_activity").select("*"),
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("is_published", true),
  ]);

  const views = pv.data ?? [];
  const clickRows = clicks.data ?? [];
  const apptRows = appts.data ?? [];

  // 일자별 집계 — '접속자'는 세션 수, 페이지뷰는 보조 지표
  const byDay = new Map<string, { v: number; s: Set<string> }>();
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    byDay.set(d, { v: 0, s: new Set() });
  }
  views.forEach((r) => {
    const d = String(r.created_at).slice(0, 10);
    const e = byDay.get(d);
    if (e) {
      e.v++;
      if (r.session_id) e.s.add(r.session_id);
    }
  });
  const series: Point[] = [...byDay.entries()].map(([day, e]) => ({
    label: `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`,
    value: e.s.size,
    sub: `페이지뷰 ${e.v.toLocaleString("ko-KR")}`,
  }));
  const sessions = [...byDay.values()].reduce((a, e) => a + e.s.size, 0);

  const mobile = views.filter((r) => r.device === "mobile").length;
  const mobilePct = views.length ? Math.round((mobile / views.length) * 100) : 0;

  const clickBy = new Map<string, number>();
  clickRows.forEach((r) => clickBy.set(r.target, (clickBy.get(r.target) ?? 0) + 1));
  const topClicks = [...clickBy.entries()].sort((a, b) => b[1] - a[1]);

  const pathBy = new Map<string, number>();
  views.forEach((r) => pathBy.set(r.path, (pathBy.get(r.path) ?? 0) + 1));
  const topPaths = [...pathBy.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  const newAppt = apptRows.filter((r) => r.status === "new").length;
  const totalClicks = clickRows.length;
  // 전환율 = 문의성 클릭(톡톡·전화·자가체크) / 세션
  const leadClicks = clickRows.filter((r) =>
    ["talktalk", "tel", "selfcheck", "reserve"].includes(r.target)
  ).length;
  const cvr = sessions ? Math.round((leadClicks / sessions) * 1000) / 10 : 0;

  return (
    <>
      <header className="adm-head">
        <div>
          <span className="adm-eyebrow">총괄 관리자</span>
          <h1>대시보드</h1>
        </div>
        <nav className="adm-filter">
          {PERIODS.map((p) => (
            <a key={p} href={`/admin?d=${p}&c=${kind}`} className={p === DAYS ? "on" : ""}>
              {p}일
            </a>
          ))}
        </nav>
      </header>

      <section className="adm-kpi">
        <Kpi label="페이지뷰" value={views.length.toLocaleString("ko-KR")} sub={`세션 ${sessions.toLocaleString("ko-KR")}`} />
        <Kpi label="CTA 클릭" value={totalClicks.toLocaleString("ko-KR")} sub={`문의 전환 ${cvr}%`} />
        <Kpi label="신규 예약" value={String(newAppt)} sub={`전체 ${apptRows.length}건`} tone={newAppt > 0 ? "hot" : undefined} />
        <Kpi label="모바일 비중" value={`${mobilePct}%`} sub={`${mobile.toLocaleString("ko-KR")} / ${views.length.toLocaleString("ko-KR")}`} />
        <Kpi label="치료후기" value={String(reviews.count ?? 0)} sub={`공개글 ${posts.count ?? 0}`} />
      </section>

      <section className="adm-card">
        <div className="adm-card-head">
          <h2>일별 접속자</h2>
          <nav className="adm-toggle">
            <a href={`/admin?d=${DAYS}&c=line`} className={kind === "line" ? "on" : ""}>꺾은선</a>
            <a href={`/admin?d=${DAYS}&c=bar`} className={kind === "bar" ? "on" : ""}>막대</a>
          </nav>
        </div>
        <Chart data={series} kind={kind} unit="명" />
        <p className="adm-sub">
          접속자 = 하루 동안의 방문 세션 수. 막대/점에 올리면 그날 페이지뷰가 같이 보입니다.
        </p>
      </section>

      <div className="adm-grid2">
        <section className="adm-card">
          <h2>CTA 클릭</h2>
          {topClicks.length === 0 ? (
            <Empty>아직 수집된 클릭이 없습니다.</Empty>
          ) : (
            <ul className="adm-bars">
              {topClicks.map(([k, v]) => (
                <li key={k}>
                  <span>{CTA_LABEL[k] ?? k}</span>
                  <i style={{ width: `${(v / topClicks[0][1]) * 100}%` }} />
                  <b>{v.toLocaleString("ko-KR")}</b>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="adm-card">
          <h2>인기 페이지</h2>
          {topPaths.length === 0 ? (
            <Empty>아직 수집된 방문이 없습니다.</Empty>
          ) : (
            <ul className="adm-bars">
              {topPaths.map(([k, v]) => (
                <li key={k}>
                  <span>{k}</span>
                  <i style={{ width: `${(v / topPaths[0][1]) * 100}%` }} />
                  <b>{v.toLocaleString("ko-KR")}</b>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="adm-card">
        <div className="adm-card-head">
          <h2>직원 업무</h2>
          <Link href="/admin/staff-activity">전체 보기 →</Link>
        </div>
        <table className="adm-table">
          <thead>
            <tr>
              <th>이름</th>
              <th>권한</th>
              <th>총 처리</th>
              <th>최근 7일</th>
              <th>마지막 활동</th>
            </tr>
          </thead>
          <tbody>
            {(staff.data ?? []).map((s: Record<string, unknown>) => (
              <tr key={String(s.id)}>
                <td>{(s.name as string) || (s.email as string)}</td>
                <td>
                  <span className={`adm-tag ${s.role === "admin" ? "on" : ""}`}>
                    {s.role === "admin" ? "관리자" : "직원"}
                  </span>
                </td>
                <td>{Number(s.actions ?? 0).toLocaleString("ko-KR")}</td>
                <td>{Number(s.actions_7d ?? 0).toLocaleString("ko-KR")}</td>
                <td>{s.last_at ? new Date(String(s.last_at)).toLocaleString("ko-KR") : "—"}</td>
              </tr>
            ))}
            {(staff.data ?? []).length === 0 && (
              <tr>
                <td colSpan={5}>
                  <Empty>등록된 직원이 없습니다.</Empty>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}

const CTA_LABEL: Record<string, string> = {
  talktalk: "네이버 톡톡",
  selfcheck: "증상 자가체크",
  tel: "전화 걸기",
  reserve: "온라인 예약",
  evidence: "20년의 증거",
  sms: "약도 문자",
};

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "hot";
}) {
  return (
    <div className={`adm-kpi-item${tone === "hot" ? " hot" : ""}`}>
      <span>{label}</span>
      <b>{value}</b>
      {sub && <i>{sub}</i>}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="adm-empty">{children}</p>;
}

/** 직원 계정으로 /admin 진입 시 보이는 요약 */
async function StaffHome() {
  const supabase = await createClient();
  const [newAppt, todayAppt] = await Promise.all([
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .gte("preferred_at", new Date().toISOString().slice(0, 10)),
  ]);

  return (
    <>
      <header className="adm-head">
        <div>
          <span className="adm-eyebrow">직원</span>
          <h1>오늘 할 일</h1>
        </div>
      </header>
      <section className="adm-kpi">
        <Kpi label="신규 예약" value={String(newAppt.count ?? 0)} tone={(newAppt.count ?? 0) > 0 ? "hot" : undefined} />
        <Kpi label="오늘 이후 예약" value={String(todayAppt.count ?? 0)} />
      </section>
      <section className="adm-card">
        <h2>바로가기</h2>
        <div className="adm-quick">
          <Link href="/admin/appointments">예약 관리</Link>
          <Link href="/admin/sms">문자 발송</Link>
          <Link href="/admin/posts">게시판</Link>
          <Link href="/admin/reviews">후기 관리</Link>
        </div>
      </section>
    </>
  );
}
