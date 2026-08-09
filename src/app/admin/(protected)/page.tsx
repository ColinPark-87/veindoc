import { getMe, isAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import Link from "next/link";
import Chart, { type Point } from "@/components/admin/Chart";
import { ymd } from "@/lib/holidays";
import { sendTodayReminders, toggleArrival } from "./care-actions";

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

/** 직원 계정으로 /admin 진입 시 보이는 화면 = 오늘 진료 보드.
 *  직원이 하루에 가장 많이 하는 일(누가 오늘 오는가 · 왔는가 · 안 온 사람 챙기기)을
 *  첫 화면에서 끝내도록 모아 둔다. */
async function StaffHome() {
  const supabase = await createClient();
  const today = ymd(new Date());
  const weekLater = new Date(Date.now() + 7 * 864e5).toISOString();

  const [todayRes, newRes, nextRes, openInq] = await Promise.all([
    supabase
      .from("appointments")
      .select("id,name,phone,patient_id,preferred_at,status,arrived_at,doctor,day_note,branch")
      .gte("preferred_at", `${today}T00:00:00`)
      .lte("preferred_at", `${today}T23:59:59`)
      .neq("status", "cancelled")
      .order("preferred_at"),
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase
      .from("appointments")
      .select("id,name,phone,next_at,doctor")
      .gt("next_at", new Date().toISOString())
      .lte("next_at", weekLater)
      .order("next_at")
      .limit(20),
    supabase
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .is("handled_at", null),
  ]);

  const list = todayRes.data ?? [];
  const pending = list.filter((a) => !a.arrived_at);
  const arrived = list.length - pending.length;
  const upcoming = nextRes.data ?? [];

  return (
    <>
      <header className="adm-head">
        <div>
          <span className="adm-eyebrow">직원</span>
          <h1>오늘 진료</h1>
        </div>
        <span className="adm-period">
          {new Date().toLocaleDateString("ko-KR", {
            month: "long",
            day: "numeric",
            weekday: "long",
          })}
        </span>
      </header>

      <section className="adm-kpi">
        <Kpi label="오늘 예약" value={String(list.length)} sub={`내원 ${arrived}명`} />
        <Kpi
          label="미내원"
          value={String(pending.length)}
          sub="아직 안 오신 분"
          tone={pending.length > 0 ? "hot" : undefined}
        />
        <Kpi label="신규 접수" value={String(newRes.count ?? 0)} sub="확인 전 예약" />
        <Kpi label="미처리 문의" value={String(openInq.count ?? 0)} sub="상담·약도 요청" />
      </section>

      <section className="adm-card">
        <div className="adm-card-head">
          <h2>오늘 오시는 분</h2>
          <div className="cal-tools">
            {pending.length > 0 && (
              <form action={sendTodayReminders}>
                <input type="hidden" name="day" value={today} />
                <button type="submit" className="cal-refresh">
                  미내원 {pending.length}명에게 안내 문자
                </button>
              </form>
            )}
            <Link href={`/admin/calendar?d=${today}`}>캘린더에서 보기 →</Link>
          </div>
        </div>

        {list.length === 0 ? (
          <p className="adm-empty">오늘 예약이 없습니다.</p>
        ) : (
          <ul className="cal-visits">
            {list.map((v) => (
              <li key={v.id} className={v.arrived_at ? "in" : ""}>
                <div className="cv-top">
                  <span className="cv-time">
                    {v.preferred_at
                      ? new Date(v.preferred_at).toLocaleTimeString("ko-KR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </span>
                  <b className="cv-name">
                    {v.patient_id ? (
                      <Link href={`/admin/patients/${v.patient_id}`}>{v.name}</Link>
                    ) : (
                      v.name
                    )}
                  </b>
                  <a className="cv-tel" href={`tel:${v.phone}`}>{v.phone}</a>
                  {v.doctor && <span className="adm-tag">{v.doctor}</span>}
                  {v.day_note && <span className="adm-sub">{v.day_note}</span>}
                  <form action={toggleArrival} className="cv-check">
                    <input type="hidden" name="id" value={v.id} />
                    <input type="hidden" name="arrived" value={v.arrived_at ? "0" : "1"} />
                    <button type="submit" className={v.arrived_at ? "on" : ""}>
                      {v.arrived_at ? "내원함" : "내원 체크"}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="adm-grid2">
        <section className="adm-card">
          <h2>다음 진료 예정 (7일)</h2>
          {upcoming.length === 0 ? (
            <p className="adm-empty">예정된 재진이 없습니다.</p>
          ) : (
            <table className="adm-table">
              <thead>
                <tr><th>일시</th><th>환자</th><th>연락처</th><th>주치의</th></tr>
              </thead>
              <tbody>
                {upcoming.map((u) => (
                  <tr key={u.id}>
                    <td className="nowrap">
                      {new Date(u.next_at as string).toLocaleString("ko-KR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td>{u.name}</td>
                    <td className="nowrap"><a href={`tel:${u.phone}`}>{u.phone}</a></td>
                    <td>{u.doctor || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="adm-card">
          <h2>바로가기</h2>
          <div className="adm-quick">
            <Link href="/admin/calendar">진료 캘린더</Link>
            <Link href="/admin/patients">환자 관리</Link>
            <Link href="/admin/appointments">예약 관리</Link>
            <Link href="/admin/inquiries">상담 요청</Link>
            <Link href="/admin/sms">문자 발송</Link>
            <Link href="/admin/posts">게시판</Link>
            <Link href="/admin/reviews">후기 관리</Link>
          </div>
        </section>
      </div>
    </>
  );
}
