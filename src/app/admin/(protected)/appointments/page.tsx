import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { updateAppointment } from "./actions";
import { linkPatient, toggleArrival } from "../care-actions";

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
  searchParams: Promise<{ s?: string; q?: string }>;
}) {
  const { s, q = "" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("appointments")
    .select(
      "id,name,phone,branch,preferred_at,symptoms,memo,status,source,created_at,patient_id,arrived_at,doctor,day_note"
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (s && STATUS[s]) query = query.eq("status", s);

  const term = q.trim();
  if (term) {
    const digits = term.replace(/[^0-9]/g, "");
    query = digits
      ? query.or(`name.ilike.%${term}%,phone.ilike.%${digits}%`)
      : query.ilike("name", `%${term}%`);
  }

  const { data, error } = await query;
  const rows = data ?? [];
  const unlinked = rows.filter((r) => !r.patient_id).length;

  const link = (o: Record<string, string>) =>
    `/admin/appointments?${new URLSearchParams({ s: s ?? "", q, ...o })}`;

  return (
    <>
      <header className="adm-head">
        <div>
          <span className="adm-eyebrow">직원</span>
          <h1>예약 관리</h1>
        </div>
        <form className="adm-search" action="/admin/appointments">
          <input type="hidden" name="s" value={s ?? ""} />
          <input name="q" defaultValue={q} placeholder="이름 또는 전화번호" aria-label="예약 검색" />
          <button type="submit">검색</button>
        </form>
      </header>

      <nav className="adm-filter">
        <a href={link({ s: "" })} className={!s ? "on" : ""}>전체</a>
        {Object.entries(STATUS).map(([k, v]) => (
          <a key={k} href={link({ s: k })} className={s === k ? "on" : ""}>{v}</a>
        ))}
      </nav>

      {error && <p className="adm-msg err">불러오지 못했습니다: {error.message}</p>}

      {unlinked > 0 && (
        <p className="adm-msg warn">
          환자로 연결되지 않은 예약이 {unlinked}건 있습니다. <b>환자 연결</b>을 누르면 이름·전화번호
          기준으로 환자 기록에 이어 붙습니다(같은 사람이면 기존 기록에 누적).
        </p>
      )}

      <section className="adm-card">
        <table className="adm-table">
          <thead>
            <tr>
              <th>접수</th>
              <th>이름</th>
              <th>연락처</th>
              <th>희망일시</th>
              <th>주치의</th>
              <th>상태 / 내원</th>
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
                <td>
                  {r.patient_id ? (
                    <Link href={`/admin/patients/${r.patient_id}`}>{r.name}</Link>
                  ) : (
                    <>
                      {r.name}
                      <form action={linkPatient} className="adm-row-form">
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="name" value={r.name} />
                        <input type="hidden" name="phone" value={r.phone} />
                        <input type="hidden" name="branch" value={r.branch ?? "대전"} />
                        <input type="hidden" name="doctor" value={r.doctor ?? ""} />
                        <button type="submit">환자 연결</button>
                      </form>
                    </>
                  )}
                </td>
                <td className="nowrap">
                  <a href={`tel:${String(r.phone).replace(/-/g, "")}`}>{r.phone}</a>
                </td>
                <td className="nowrap">
                  {r.preferred_at ? new Date(r.preferred_at).toLocaleString("ko-KR") : "—"}
                </td>
                <td>{r.doctor || "—"}</td>
                <td>
                  <span className={`adm-status ${r.status}`}>{STATUS[r.status] ?? r.status}</span>
                  <form action={toggleArrival} className="adm-row-form">
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="arrived" value={r.arrived_at ? "0" : "1"} />
                    <button type="submit" className={r.arrived_at ? "on" : ""}>
                      {r.arrived_at ? "내원함" : "내원 체크"}
                    </button>
                  </form>
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
                  {r.day_note && <i className="adm-sub">당일 기록: {r.day_note}</i>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <p className="adm-empty">
                    {term || s
                      ? "조건에 맞는 예약이 없습니다."
                      : "예약이 없습니다. 진료 캘린더에서 날짜를 골라 추가할 수 있습니다."}
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
