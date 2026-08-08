import { createClient } from "@/lib/supabase-server";
import { createPost, togglePost, deletePost } from "./actions";

export const dynamic = "force-dynamic";

const CAT: Record<string, string> = { notice: "공지사항", news: "병원소식", faq: "자주 묻는 질문" };

export default async function Page() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select("id,category,title,is_published,pinned,views,created_at")
    .order("created_at", { ascending: false })
    .limit(60);

  return (
    <>
      <header className="adm-head">
        <div>
          <span className="adm-eyebrow">직원</span>
          <h1>게시판 관리</h1>
        </div>
      </header>

      <div className="adm-grid2">
        <section className="adm-card">
          <h2>새 글 작성</h2>
          <form action={createPost} className="adm-form">
            <label>
              <span>분류</span>
              <select name="category" defaultValue="notice">
                {Object.entries(CAT).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              <span>제목</span>
              <input name="title" required placeholder="예: 8월 휴진 안내" />
            </label>
            <label>
              <span>내용</span>
              <textarea name="body" rows={7} placeholder="본문을 입력하세요." />
            </label>
            <label className="adm-check">
              <input type="checkbox" name="publish" defaultChecked />
              <span>바로 공개</span>
            </label>
            <button type="submit">등록</button>
          </form>
        </section>

        <section className="adm-card">
          <h2>글 목록</h2>
          <table className="adm-table">
            <thead>
              <tr>
                <th>분류</th>
                <th>제목</th>
                <th>조회</th>
                <th>상태</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((p) => (
                <tr key={p.id}>
                  <td className="nowrap">{CAT[p.category] ?? p.category}</td>
                  <td>{p.title}</td>
                  <td>{p.views}</td>
                  <td>
                    <span className={`adm-status ${p.is_published ? "done" : "new"}`}>
                      {p.is_published ? "공개" : "비공개"}
                    </span>
                  </td>
                  <td>
                    <div className="adm-row-form">
                      <form action={togglePost}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="next" value={p.is_published ? "0" : "1"} />
                        <button type="submit">{p.is_published ? "숨기기" : "공개"}</button>
                      </form>
                      <form action={deletePost}>
                        <input type="hidden" name="id" value={p.id} />
                        <button type="submit" className="danger">삭제</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {(data ?? []).length === 0 && (
                <tr>
                  <td colSpan={5}><p className="adm-empty">등록된 글이 없습니다.</p></td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
