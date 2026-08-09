import { createClient } from "@/lib/supabase-server";
import { getMe, isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ymd } from "@/lib/holidays";

export const dynamic = "force-dynamic";

/** 관리자 전용 — 누가 언제 무엇을 했는지 날짜별로 본다.
 *  직원 실적이 '얼마나 했나'라면 여기는 '무엇을 했나'다. */

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
  "post.unpublish": "글 숨김",
  "post.delete": "글 삭제",
  "review.hide": "후기 숨김",
  "review.show": "후기 공개",
  "review.delete": "후기 삭제",
  "profile.role": "권한 변경",
  "settings.update": "진료시간 변경",
};

type Row = {
  id: number;
  actor: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
  profiles: { name?: string; email?: string } | null;
};

const DAYS = 14;

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; who?: string; a?: string }>;
}) {
  const me = await getMe();
  if (!isAdmin(me)) redirect("/admin");

  const sp = await searchParams;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(sp.d ?? "") ? sp.d! : ymd(new Date());
  const who = sp.who ?? "";
  const action = sp.a ?? "";

  const supabase = await createClient();
  const since = new Date(Date.now() - DAYS * 864e5).toISOString();

  const [dayRes, spanRes, staffRes] = await Promise.all([
    supabase
      .from("activity_logs")
      .select("id,actor,action,entity,entity_id,detail,created_at,profiles(name,email)")
      .gte("created_at", `${day}T00:00:00`)
      .lte("created_at", `${day}T23:59:59.999`)
      .order("created_at", { ascending: false })
      .limit(500),
    // 날짜 탭에 건수를 같이 띄우려면 최근 구간을 한 번 더 읽어야 한다
    supabase
      .from("activity_logs")
      .select("created_at")
      .gte("created_at", since)
      .limit(5000),
    supabase.from("v_staff_activity").select("id,name,email"),
  ]);

  const rowsAll = (dayRes.data ?? []) as unknown as Row[];
  const rows = rowsAll.filter(
    (r) => (!who || r.actor === who) && (!action || r.action === action)
  );

  const perDay = new Map<string, number>();
  for (let i = DAYS - 1; i >= 0; i--) {
    perDay.set(ymd(new Date(Date.now() - i * 864e5)), 0);
  }
  for (const r of spanRes.data ?? []) {
    const k = String(r.created_at).slice(0, 10);
    if (perDay.has(k)) perDay.set(k, perDay.get(k)! + 1);
  }

  const staff = (staffRes.data ?? []) as { id: string; name: string | null; email: string | null }[];
  const actions = [...new Set(rowsAll.map((r) => r.action))].sort();

  // 같은 사람이 연달아 한 작업은 한 줄기로 보이게 시간순으로 세운다
  const ordered = [...rows].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const link = (o: Record<string, string>) =>
    `/admin/logs?${new URLSearchParams({ d: day, who, a: action, ...o })}`;

  const nameOf = (r: Row) =>
    r.profiles?.name ||
    r.profiles?.email ||
    staff.find((s) => s.id === r.actor)?.name ||
    "미상";

  return (
    <>
      <header className="adm-head">
        <div>
          <span className="adm-eyebrow">총괄 관리자</span>
          <h1>작업 로그</h1>
        </div>
        <form className="cal-jump" action="/admin/logs">
          <input type="hidden" name="who" value={who} />
          <input type="hidden" name="a" value={action} />
          <input type="date" name="d" defaultValue={day} aria-label="날짜" />
          <button type="submit">이동</button>
        </form>
      </header>

      <section className="adm-card">
        <h2>최근 {DAYS}일</h2>
        <nav className="log-days">
          {[...perDay.entries()].map(([d, n]) => (
            <a key={d} href={link({ d })} className={d === day ? "on" : ""}>
              <b>{Number(d.slice(5, 7))}/{Number(d.slice(8, 10))}</b>
              <i>{n}</i>
            </a>
          ))}
        </nav>
      </section>

      <nav className="adm-filter">
        <a href={link({ who: "" })} className={!who ? "on" : ""}>모든 직원</a>
        {staff.map((s) => (
          <a key={s.id} href={link({ who: s.id })} className={who === s.id ? "on" : ""}>
            {s.name || s.email}
          </a>
        ))}
      </nav>

      {actions.length > 0 && (
        <nav className="adm-filter">
          <a href={link({ a: "" })} className={!action ? "on" : ""}>모든 작업</a>
          {actions.map((a) => (
            <a key={a} href={link({ a })} className={action === a ? "on" : ""}>
              {ACTION_LABEL[a] ?? a}
            </a>
          ))}
        </nav>
      )}

      <section className="adm-card">
        <div className="adm-card-head">
          <h2>
            {new Date(`${day}T00:00:00`).toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "long",
            })}
          </h2>
          <span className="adm-sub">{rows.length}건</span>
        </div>

        {ordered.length === 0 ? (
          <p className="adm-empty">이 날 기록된 작업이 없습니다.</p>
        ) : (
          <ol className="log-line">
            {ordered.map((r) => (
              <li key={r.id}>
                <span className="lg-time">
                  {new Date(r.created_at).toLocaleTimeString("ko-KR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="lg-who">{nameOf(r)}</span>
                <span className="lg-act">{ACTION_LABEL[r.action] ?? r.action}</span>
                <span className="lg-tgt">
                  {r.entity ? `${r.entity} ${r.entity_id ?? ""}` : ""}
                  {r.detail && Object.keys(r.detail).length > 0 && (
                    <i className="adm-sub">{JSON.stringify(r.detail)}</i>
                  )}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className="adm-sub">
        기록은 직원이 관리자 화면에서 실제로 수행한 작업입니다. 직원 계정은 자기 기록만,
        관리자는 전체를 볼 수 있습니다(RLS로 DB 단에서 구분).
      </p>
    </>
  );
}
