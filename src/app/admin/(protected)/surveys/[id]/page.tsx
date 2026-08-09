import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getMe, isAdmin } from "@/lib/auth";
import Chart from "@/components/admin/Chart";
import {
  KIND_LABEL,
  tally,
  type Answers,
  type Question,
  type Survey,
} from "@/lib/surveys";
import {
  addQuestion,
  deleteQuestion,
  deleteSurvey,
  moveQuestion,
  updateSurvey,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function SurveyDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await getMe();
  const supabase = await createClient();

  const { data: survey } = await supabase
    .from("surveys")
    .select("id,slug,title,intro,status,ask_contact,thanks")
    .eq("id", id)
    .maybeSingle();
  if (!survey) notFound();
  const s = survey as Survey;

  const [qRes, rRes] = await Promise.all([
    supabase
      .from("survey_questions")
      .select("id,ord,kind,label,options,required")
      .eq("survey_id", id)
      .order("ord"),
    supabase
      .from("survey_responses")
      .select("id,answers,name,phone,created_at")
      .eq("survey_id", id)
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  const questions = (qRes.data ?? []) as Question[];
  const responses = rRes.data ?? [];
  const stats = tally(questions, responses.map((r) => (r.answers ?? {}) as Answers));

  return (
    <>
      <header className="adm-head">
        <div>
          <span className="adm-eyebrow">
            <Link href="/admin/surveys">설문</Link> · 편집과 통계
          </span>
          <h1>{s.title}</h1>
        </div>
        <span className="adm-period">
          응답 {responses.length.toLocaleString("ko-KR")}건
        </span>
      </header>

      {s.status === "open" && (
        <p className="adm-msg ok">
          지금 공개 중입니다. 응답 주소: <b>/survey/{s.slug}</b> — 사이트 <b>설문</b> 탭에도 떠 있습니다.
        </p>
      )}

      <section className="adm-card">
        <h2>설문 설정</h2>
        <form action={updateSurvey} className="cv-form">
          <input type="hidden" name="id" value={s.id} />
          <label className="grow">
            <span>제목</span>
            <input name="title" defaultValue={s.title} required />
          </label>
          <label className="grow">
            <span>안내 문구</span>
            <input name="intro" defaultValue={s.intro} />
          </label>
          <label className="grow">
            <span>제출 후 문구</span>
            <input name="thanks" defaultValue={s.thanks} />
          </label>
          <label>
            <span>상태</span>
            <select name="status" defaultValue={s.status}>
              <option value="draft">작성 중</option>
              <option value="open">응답 받는 중</option>
              <option value="closed">마감</option>
            </select>
          </label>
          <label className="adm-check">
            <input type="checkbox" name="ask_contact" defaultChecked={s.ask_contact} />
            <span>이름·연락처 받기</span>
          </label>
          <button type="submit">저장</button>
        </form>
      </section>

      <section className="adm-card">
        <div className="adm-card-head">
          <h2>문항 {questions.length}개</h2>
          <span className="adm-sub">순서를 바꿔도 이미 들어온 응답의 집계는 어긋나지 않습니다</span>
        </div>

        {questions.length === 0 ? (
          <p className="adm-empty">문항이 없습니다. 아래에서 추가하세요.</p>
        ) : (
          <ul className="sv-qlist">
            {questions.map((q, i) => (
              <li key={q.id}>
                <div className="sv-qhead">
                  <span className="sv-num">{i + 1}</span>
                  <b>{q.label}</b>
                  <span className="adm-tag">{KIND_LABEL[q.kind]}</span>
                  {q.required && <span className="adm-tag">필수</span>}
                  <span className="sv-qtools">
                    <form action={moveQuestion}>
                      <input type="hidden" name="id" value={q.id} />
                      <input type="hidden" name="survey_id" value={s.id} />
                      <input type="hidden" name="dir" value="up" />
                      <button type="submit" disabled={i === 0} aria-label="위로">위로</button>
                    </form>
                    <form action={moveQuestion}>
                      <input type="hidden" name="id" value={q.id} />
                      <input type="hidden" name="survey_id" value={s.id} />
                      <input type="hidden" name="dir" value="down" />
                      <button type="submit" disabled={i === questions.length - 1} aria-label="아래로">
                        아래로
                      </button>
                    </form>
                    <form action={deleteQuestion}>
                      <input type="hidden" name="id" value={q.id} />
                      <input type="hidden" name="survey_id" value={s.id} />
                      <button type="submit" className="danger">삭제</button>
                    </form>
                  </span>
                </div>
                {q.options.length > 0 && (
                  <span className="adm-chips">
                    {q.options.map((o) => <em key={o}>{o}</em>)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        <details className="cal-add">
          <summary>문항 추가</summary>
          <form action={addQuestion} className="cv-form">
            <input type="hidden" name="survey_id" value={s.id} />
            <label className="grow">
              <span>질문</span>
              <input name="label" required placeholder="예: 시술 후 통증은 어느 정도였나요?" />
            </label>
            <label>
              <span>형식</span>
              <select name="kind" defaultValue="single">
                <option value="single">단일 선택</option>
                <option value="multi">복수 선택</option>
                <option value="scale">5점 척도</option>
                <option value="text">주관식</option>
              </select>
            </label>
            <label className="grow">
              <span>선택지 (줄바꿈으로 구분 · 선택형만)</span>
              <textarea name="options" rows={3} placeholder={"전혀 없었다\n약간 있었다\n심했다"} />
            </label>
            <label className="adm-check">
              <input type="checkbox" name="required" defaultChecked />
              <span>필수</span>
            </label>
            <button type="submit">추가</button>
          </form>
        </details>
      </section>

      <section className="adm-card">
        <div className="adm-card-head">
          <h2>응답 통계</h2>
          <span className="adm-sub">응답이 들어오는 즉시 반영됩니다</span>
        </div>

        {responses.length === 0 ? (
          <p className="adm-empty">아직 응답이 없습니다.</p>
        ) : (
          questions.map((q, i) => {
            const st = stats.get(q.id);
            if (!st) return null;
            return (
              <div key={q.id} className="sv-stat">
                <h3>
                  <span className="sv-num">{i + 1}</span> {q.label}
                  <i className="adm-sub">
                    {KIND_LABEL[q.kind]} · 응답 {st.total}건
                    {st.kind === "scale" && ` · 평균 ${st.avg}점`}
                  </i>
                </h3>

                {st.kind === "text" ? (
                  st.texts.length === 0 ? (
                    <p className="adm-empty">주관식 응답 없음</p>
                  ) : (
                    <ul className="sv-texts">
                      {st.texts.slice(0, 30).map((t, k) => <li key={k}>{t}</li>)}
                      {st.texts.length > 30 && (
                        <li className="adm-sub">외 {st.texts.length - 30}건</li>
                      )}
                    </ul>
                  )
                ) : (
                  <Chart
                    data={st.rows.map((r) => ({ label: r.label, value: r.n }))}
                    kind="bar"
                    unit="명"
                    tickEvery={1}
                    height={180}
                  />
                )}
              </div>
            );
          })
        )}
      </section>

      {isAdmin(me) && (
        <section className="adm-card">
          <h2>설문 삭제</h2>
          <p className="adm-sub">
            응답까지 함께 지워집니다. 되돌릴 수 없으니 마감(closed)으로 두는 편이 안전합니다.
          </p>
          <form action={deleteSurvey} className="adm-row-form">
            <input type="hidden" name="id" value={s.id} />
            <button type="submit" className="danger">이 설문과 응답 전부 삭제</button>
          </form>
        </section>
      )}
    </>
  );
}
