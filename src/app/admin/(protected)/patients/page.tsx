import Link from "next/link";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type Patient = {
  id: string;
  name: string;
  phone: string;
  branch: string;
  doctor: string;
  memo: string;
  first_seen: string;
  last_seen: string | null;
};

const fmtPhone = (p: string) =>
  p.length === 11 ? `${p.slice(0, 3)}-${p.slice(3, 7)}-${p.slice(7)}` : p;

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("patients")
    .select("id,name,phone,branch,doctor,memo,first_seen,last_seen")
    .order("last_seen", { ascending: false, nullsFirst: false })
    .limit(200);

  const term = q.trim();
  if (term) {
    const digits = term.replace(/[^0-9]/g, "");
    query = digits
      ? query.or(`name.ilike.%${term}%,phone.ilike.%${digits}%`)
      : query.ilike("name", `%${term}%`);
  }

  const { data, error } = await query;
  const rows = (data ?? []) as Patient[];

  // 방문 횟수는 환자별 집계라 한 번에 가져와 붙인다
  const ids = rows.map((r) => r.id);
  const counts = new Map<string, number>();
  if (ids.length) {
    const { data: appts } = await supabase
      .from("appointments")
      .select("patient_id")
      .in("patient_id", ids);
    (appts ?? []).forEach((a) => {
      const k = String(a.patient_id);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    });
  }

  // 같은 이름이 둘 이상이면 동명이인 — 전화번호로 구분한다는 표시를 붙인다
  const nameCount = new Map<string, number>();
  rows.forEach((r) => nameCount.set(r.name, (nameCount.get(r.name) ?? 0) + 1));

  return (
    <>
      <header className="adm-head">
        <div>
          <span className="adm-eyebrow">직원</span>
          <h1>환자 관리</h1>
        </div>
        <form className="adm-search" action="/admin/patients">
          <input name="q" defaultValue={q} placeholder="이름 또는 전화번호" aria-label="환자 검색" />
          <button type="submit">검색</button>
        </form>
      </header>

      {error && <p className="adm-msg err">불러오지 못했습니다: {error.message}</p>}

      <section className="adm-card">
        <table className="adm-table">
          <thead>
            <tr>
              <th>이름</th>
              <th>전화번호</th>
              <th>주치의</th>
              <th>진료 횟수</th>
              <th>최근 진료</th>
              <th>메모</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/admin/patients/${r.id}`}>{r.name}</Link>
                  {(nameCount.get(r.name) ?? 0) > 1 && <span className="adm-tag">동명이인</span>}
                </td>
                <td className="nowrap">
                  <a href={`tel:${r.phone}`}>{fmtPhone(r.phone)}</a>
                </td>
                <td>{r.doctor || "—"}</td>
                <td>{(counts.get(r.id) ?? 0).toLocaleString("ko-KR")}</td>
                <td className="nowrap">
                  {r.last_seen ? new Date(r.last_seen).toLocaleDateString("ko-KR") : "—"}
                </td>
                <td className="adm-sub">{r.memo || "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <p className="adm-empty">
                    {term ? "검색 결과가 없습니다." : "등록된 환자가 없습니다. 캘린더에서 예약을 등록하면 여기에 쌓입니다."}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <p className="adm-sub">
        누적 기준: 환자 이름. 이름이 같아도 전화번호가 다르면 다른 사람으로 분리해 관리합니다.
      </p>
    </>
  );
}
