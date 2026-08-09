import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { createSurvey } from "./actions";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  draft: "작성 중",
  open: "응답 받는 중",
  closed: "마감",
};

export default async function SurveysPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_survey_counts")
    .select("*")
    .order("last_at", { ascending: false, nullsFirst: false });

  const rows = (data ?? []) as {
    id: string;
    slug: string;
    title: string;
    status: string;
    responses: number;
    last_at: string | null;
  }[];

  return (
    <>
      <header className="adm-head">
        <div>
          <span className="adm-eyebrow">직원</span>
          <h1>설문</h1>
        </div>
      </header>

      <div className="adm-note">
        여기서 만든 설문은 <b>응답 받는 중</b>으로 바꾸는 순간 사이트 <b>설문</b> 탭에 뜨고,
        들어온 답은 곧바로 이 화면의 통계에 반영됩니다. 따로 옮기는 작업이 없습니다.
      </div>

      {error && <p className="adm-msg err">불러오지 못했습니다: {error.message}</p>}

      <section className="adm-card">
        <h2>새 설문</h2>
        <form action={createSurvey} className="cv-form">
          <label className="grow">
            <span>제목</span>
            <input name="title" required placeholder="예: 치료 후 만족도 조사" />
          </label>
          <label className="grow">
            <span>안내 문구</span>
            <input name="intro" placeholder="응답자에게 보여줄 설명" />
          </label>
          <label className="adm-check">
            <input type="checkbox" name="ask_contact" />
            <span>이름·연락처 받기</span>
          </label>
          <button type="submit">만들기</button>
        </form>
      </section>

      <section className="adm-card">
        <table className="adm-table">
          <thead>
            <tr>
              <th>제목</th><th>상태</th><th>응답</th><th>최근 응답</th><th>공개 주소</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td><Link href={`/admin/surveys/${s.id}`}>{s.title}</Link></td>
                <td>
                  <span className={`adm-tag ${s.status === "open" ? "on" : ""}`}>
                    {STATUS[s.status] ?? s.status}
                  </span>
                </td>
                <td>{Number(s.responses ?? 0).toLocaleString("ko-KR")}</td>
                <td className="nowrap">
                  {s.last_at ? new Date(s.last_at).toLocaleString("ko-KR") : "—"}
                </td>
                <td className="adm-sub">
                  {s.status === "open" ? `/survey/${s.slug}` : "공개 전"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <p className="adm-empty">아직 설문이 없습니다. 위에서 하나 만들어 보세요.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
