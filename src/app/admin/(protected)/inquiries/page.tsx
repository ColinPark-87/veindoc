import { createClient } from "@/lib/supabase-server";
import { resolveInquiry, sendPatientSms } from "../care-actions";

export const dynamic = "force-dynamic";

const KIND: Record<string, string> = {
  consult: "진료 상담",
  map_sms: "약도 문자",
};

const fmtPhone = (p: string) => {
  const d = String(p).replace(/[^0-9]/g, "");
  return d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : p;
};

export default async function InquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string }>;
}) {
  const { v = "open" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("inquiries")
    .select("id,name,phone,message,symptoms,branch,kind,handled_at,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (v === "open") query = query.is("handled_at", null);

  const { data, error } = await query;
  const rows = data ?? [];

  return (
    <>
      <header className="adm-head">
        <div>
          <span className="adm-eyebrow">직원</span>
          <h1>상담 요청</h1>
        </div>
        <nav className="adm-filter">
          <a href="/admin/inquiries?v=open" className={v === "open" ? "on" : ""}>미처리</a>
          <a href="/admin/inquiries?v=all" className={v === "all" ? "on" : ""}>전체</a>
        </nav>
      </header>

      {error && <p className="adm-msg err">불러오지 못했습니다: {error.message}</p>}

      <section className="adm-card">
        {rows.length === 0 ? (
          <p className="adm-empty">
            {v === "open" ? "미처리 요청이 없습니다." : "접수된 요청이 없습니다."}
          </p>
        ) : (
          <ul className="cal-visits">
            {rows.map((r) => (
              <li key={r.id} className={r.handled_at ? "in" : ""}>
                <div className="cv-top">
                  <span className="adm-tag">{KIND[r.kind] ?? r.kind}</span>
                  <b className="cv-name">{r.name}</b>
                  <a className="cv-tel" href={`tel:${String(r.phone).replace(/[^0-9]/g, "")}`}>
                    {fmtPhone(r.phone)}
                  </a>
                  <span className="adm-sub">
                    {new Date(r.created_at).toLocaleString("ko-KR")} · {r.branch}
                  </span>
                  {!r.handled_at ? (
                    <form action={resolveInquiry} className="cv-check">
                      <input type="hidden" name="id" value={r.id} />
                      <button type="submit">처리 완료</button>
                    </form>
                  ) : (
                    <span className="cv-check">
                      <button type="button" className="on" disabled>
                        {new Date(r.handled_at).toLocaleDateString("ko-KR")} 처리
                      </button>
                    </span>
                  )}
                </div>

                {r.message && <p className="adm-sub">{r.message}</p>}
                {(r.symptoms ?? []).length > 0 && (
                  <span className="adm-chips">
                    {(r.symptoms as string[]).map((x) => (
                      <em key={x}>{x}</em>
                    ))}
                  </span>
                )}

                <form action={sendPatientSms} className="cv-sms">
                  <input type="hidden" name="phone" value={r.phone} />
                  <input type="hidden" name="branch" value={r.branch ?? "대전"} />
                  <input type="hidden" name="template" value={KIND[r.kind] ?? "안내"} />
                  <input
                    name="body"
                    defaultValue={
                      r.kind === "map_sms"
                        ? `${r.name}님, 삼성흉부외과 ${r.branch} 오시는 길 안내드립니다. https://veindoc.co.kr`
                        : `${r.name}님, 삼성흉부외과 대전입니다. 문의 주신 내용 안내드립니다.`
                    }
                  />
                  <button type="submit">문자 보내기</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="adm-sub">
        사이트 우측 퀵메뉴의 <b>약도 문자받기</b>와 상담 접수가 여기로 들어옵니다.
        실제 문자 발송은 문자 API 연동 후 큐에서 처리됩니다.
      </p>
    </>
  );
}
