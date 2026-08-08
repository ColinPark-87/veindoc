import { createClient } from "@/lib/supabase-server";
import { getMe, isAdmin } from "@/lib/auth";
import { toggleReview, deleteReview } from "./actions";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; hidden?: string }>;
}) {
  const { q, hidden } = await searchParams;
  const me = await getMe();
  const supabase = await createClient();

  let sel = supabase
    .from("reviews")
    .select("id,title,body,views,is_secret,created_at", { count: "exact" })
    .order("views", { ascending: false })
    .limit(60);
  if (q) sel = sel.ilike("title", `%${q}%`);
  if (hidden === "1") sel = sel.eq("is_secret", true);

  const { data, count } = await sel;

  return (
    <>
      <header className="adm-head">
        <div>
          <span className="adm-eyebrow">직원</span>
          <h1>후기 관리 <em className="adm-count">{count ?? 0}</em></h1>
        </div>
        <form className="adm-filter" action="/admin/reviews">
          <input name="q" defaultValue={q ?? ""} placeholder="제목 검색" />
          <button type="submit">검색</button>
          <a href="/admin/reviews?hidden=1" className={hidden ? "on" : ""}>숨김만</a>
          <a href="/admin/reviews">전체</a>
        </form>
      </header>

      <p className="adm-note">
        원본 게시판은 942건 중 <b>768건이 봇 스팸</b>이었습니다(이관 시 제거).
        새로 유입되는 글도 여기서 숨김 처리하세요.
      </p>

      <section className="adm-card">
        <table className="adm-table">
          <thead>
            <tr><th>제목</th><th>본문</th><th>조회</th><th>상태</th><th></th></tr>
          </thead>
          <tbody>
            {(data ?? []).map((r) => (
              <tr key={r.id}>
                <td>{r.title}</td>
                <td className="adm-sub clamp">{r.body}</td>
                <td>{r.views}</td>
                <td>
                  <span className={`adm-status ${r.is_secret ? "cancelled" : "done"}`}>
                    {r.is_secret ? "숨김" : "공개"}
                  </span>
                </td>
                <td>
                  <div className="adm-row-form">
                    <form action={toggleReview}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="hide" value={r.is_secret ? "0" : "1"} />
                      <button type="submit">{r.is_secret ? "공개" : "숨김"}</button>
                    </form>
                    {isAdmin(me) && (
                      <form action={deleteReview}>
                        <input type="hidden" name="id" value={r.id} />
                        <button type="submit" className="danger">삭제</button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {(data ?? []).length === 0 && (
              <tr><td colSpan={5}><p className="adm-empty">후기가 없습니다.</p></td></tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
