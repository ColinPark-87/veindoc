import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { getMe, isAdmin } from "@/lib/auth";
import { dayTone, holidayYears, monthGrid, ymd } from "@/lib/holidays";
import { refreshHolidays } from "../care-actions";
import { readLocks } from "@/lib/locks";
import DayPanel from "./DayPanel";

export const dynamic = "force-dynamic";

const WEEK = ["월", "화", "수", "목", "금", "토", "일"];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string; d?: string }>;
}) {
  const sp = await searchParams;
  const me = await getMe();
  const supabase = await createClient();

  const today = new Date();
  const years = holidayYears(today);
  const year = clamp(Number(sp.y) || today.getFullYear(), years[0], years[years.length - 1]);
  const month = clamp(Number(sp.m) || today.getMonth() + 1, 1, 12);

  const cells = monthGrid(year, month);
  const from = ymd(cells[0]);
  const to = ymd(cells[cells.length - 1]);

  const [hol, appt, sync] = await Promise.all([
    supabase.from("holidays").select("day,name,is_holiday").gte("day", from).lte("day", to),
    supabase
      .from("appointments")
      .select("id,name,phone,patient_id,preferred_at,status,arrived_at,doctor,day_note,next_at,memo,branch,updated_at")
      .gte("preferred_at", `${from}T00:00:00`)
      .lte("preferred_at", `${to}T23:59:59`)
      .neq("status", "cancelled")
      .order("preferred_at"),
    supabase
      .from("holiday_syncs")
      .select("created_at,upserted,failed,source")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const holidays = new Map((hol.data ?? []).map((h) => [h.day as string, h]));
  const visits = appt.data ?? [];
  const byDay = new Map<string, typeof visits>();
  for (const v of visits) {
    const k = String(v.preferred_at).slice(0, 10);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(v);
  }

  const selected = sp.d && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : ymd(today);
  const selectedVisits = byDay.get(selected) ?? [];
  // 그날 보이는 건들의 잠금 상태를 한 번에 읽는다(행마다 조회하면 N+1)
  const locks = await readLocks("appointments", selectedVisits.map((v) => v.id), me?.id ?? "");
  const last = sync.data;
  const missingSource = !hol.data?.length || last?.source === "fixed";

  const qs = (o: Record<string, string | number>) =>
    `/admin/calendar?${new URLSearchParams(
      Object.fromEntries(Object.entries({ y: year, m: month, d: selected, ...o }).map(([k, v]) => [k, String(v)]))
    )}`;

  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  return (
    <>
      <header className="adm-head">
        <div>
          <span className="adm-eyebrow">직원</span>
          <h1>진료 캘린더</h1>
        </div>
        <div className="cal-tools">
          <form action={selectMonth} className="cal-jump">
            <input type="hidden" name="d" value={selected} />
            <select name="y" defaultValue={year} aria-label="연도">
              {years.map((y) => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
            <select name="m" defaultValue={month} aria-label="월">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{m}월</option>
              ))}
            </select>
            <button type="submit">이동</button>
          </form>
          {isAdmin(me) && (
            <form action={refreshHolidays}>
              <button type="submit" className="cal-refresh">공휴일 새로고침</button>
            </form>
          )}
        </div>
      </header>

      {missingSource && (
        <p className="adm-msg warn">
          공휴일 원천이 아직 연결되지 않았습니다. 지금은 날짜가 고정된 공휴일만 표시됩니다
          (설·추석·부처님오신날·대체공휴일 누락). 환경변수 <code>HOLIDAY_API_KEY</code>
          (공공데이터포털 특일 정보 서비스키)를 넣고 <b>공휴일 새로고침</b>을 누르면 10년치가 채워집니다.
        </p>
      )}
      {last && (
        <p className="adm-sub cal-synced">
          마지막 동기화 {new Date(last.created_at).toLocaleString("ko-KR")} · {last.upserted}일 저장
          {(last.failed as number[])?.length ? ` · 실패 ${(last.failed as number[]).join(", ")}` : ""}
        </p>
      )}

      <section className="adm-card cal-card">
        <div className="cal-head">
          <Link href={qs({ y: prev.y, m: prev.m })} aria-label="이전 달">←</Link>
          <h2>{year}년 {month}월</h2>
          <Link href={qs({ y: next.y, m: next.m })} aria-label="다음 달">→</Link>
        </div>

        <div className="cal-grid" role="grid">
          {WEEK.map((w, i) => (
            <div key={w} className={`cal-wd${i === 5 ? " sat" : i === 6 ? " sun" : ""}`}>{w}</div>
          ))}

          {cells.map((d) => {
            const key = ymd(d);
            const h = holidays.get(key);
            const tone = dayTone(d, !!h?.is_holiday);
            const list = byDay.get(key) ?? [];
            const outside = d.getMonth() + 1 !== month;
            return (
              <Link
                key={key}
                href={qs({ d: key })}
                className={[
                  "cal-day",
                  tone,
                  outside ? "out" : "",
                  key === ymd(today) ? "today" : "",
                  key === selected ? "sel" : "",
                ].filter(Boolean).join(" ")}
              >
                <b>{d.getDate()}</b>
                {h && <i className="cal-hname">{h.name}</i>}
                {list.length > 0 && (
                  <span className="cal-count">
                    {list.length}건
                    {list.some((v) => !v.arrived_at) && <em className="cal-dot" aria-label="미내원 있음" />}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </section>

      <DayPanel
        date={selected}
        holiday={holidays.get(selected)?.name ?? null}
        visits={selectedVisits}
        locks={locks}
      />
    </>
  );
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

/** 연/월 점프 — 폼 하나로 처리하고 GET 주소로 되돌린다 */
async function selectMonth(form: FormData) {
  "use server";
  const { redirect } = await import("next/navigation");
  const y = String(form.get("y") ?? "");
  const m = String(form.get("m") ?? "");
  const d = String(form.get("d") ?? "");
  redirect(`/admin/calendar?y=${y}&m=${m}&d=${d}`);
}
