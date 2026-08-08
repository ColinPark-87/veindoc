import { createClient } from "@/lib/supabase-server";
import { updateAppointment } from "./actions";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  new: "신규",
  confirmed: "확정",
  done: "완료",
  cancelled: "취소",
  noshow: "노쇼",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s } = await searchParams;
  const supabase = await createClient();

  let q = supabase
    .from("appointments")
    .select("id,name,phone,branch,preferred_at,symptoms,memo,status,source,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (s && STATUS[s]) q = q.eq("status", s);

  const { data, error } = await q;
  const rows = data ?? [];

  return (
    <>
      <header className="adm-head">
        <div>
          <span className="adm-eyebrow">직원</span>
          <h1>예약 관리</h1>
        </div>
        <nav className="adm-filter">
          <a href="/admin/appointments" className={!s ? "on" : ""}>전체</a>
          {Object.entries(STATUS).map(([k, v]) => (
            <a key={k} href={`/admin/appointments?s=${k}`} className={s === k ? "on" : ""}>
              {v}
            </a>
          ))}
        </nav>
      </header>

      {error && <p className="adm-msg err">불러오지 못했습니다: {error.message}</p>}

      <section className="adm-card">
        <table className="adm-table">
          <thead>
            <tr>
              <th>접수</th>
              <th>이름</th>
              <th>연락처</th>
              <th>희망일시</th>
              <th>증상</th>
              <th>상태</th>
              <th>메모 / 처리</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="nowrap">
                  {new Date(r.created_at).toLocaleDateString("ko-KR")}
                  <i className="adm-sub">{r.source}</i>
                </td>
                <td>{r.name}</td>
                <td className="nowrap">
                  <a href={`tel:${String(r.phone).replace(/-/g, "")}`}>{r.phone}</a>
                </td>
                <td className="nowrap">
                  {r.preferred_at ? new Date(r.preferred_at).toLocaleString("ko-KR") : "—"}
                </td>
                <td>
                  {(r.symptoms ?? []).length ? (
                    <span className="adm-chips">
                      {(r.symptoms as string[]).slice(0, 2).map((x) => (
                        <em key={x}>{x}</em>
                      ))}
                      {(r.symptoms as string[]).length > 2 && <em>+{(r.symptoms as string[]).length - 2}</em>}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  <span className={`adm-status ${r.status}`}>{STATUS[r.status] ?? r.status}</span>
                </td>
                <td>
                  <form action={updateAppointment} className="adm-row-form">
                    <input type="hidden" name="id" value={r.id} />
                    <select name="status" defaultValue={r.status}>
                      {Object.entries(STATUS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                    <input name="memo" defaultValue={r.memo ?? ""} placeholder="메모" />
                    <button type="submit">저장</button>
                  </form>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <p className="adm-empty">
                    예약이 없습니다. 홈페이지 예약 폼이 연결되면 여기에 쌓입니다.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
