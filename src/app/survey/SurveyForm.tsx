"use client";

import { useActionState } from "react";
import { submitSurvey } from "./actions";
import type { Question, Survey } from "@/lib/surveys";

const EMPTY: { ok?: boolean; error?: string } = {};

export default function SurveyForm({
  survey,
  questions,
}: {
  survey: Survey;
  questions: Question[];
}) {
  const [state, action, pending] = useActionState(submitSurvey, EMPTY);

  if (state.ok) {
    return (
      <div className="sv-done">
        <b>{survey.thanks}</b>
        <a href="/">홈으로</a>
      </div>
    );
  }

  return (
    <form action={action} className="sv-form">
      <input type="hidden" name="slug" value={survey.slug} />

      {questions.map((q, i) => (
        <fieldset key={q.id} className="sv-q">
          <legend>
            <span className="sv-num">{i + 1}</span>
            {q.label}
            {q.required && <em className="sv-req">필수</em>}
          </legend>

          {q.kind === "text" && (
            <textarea name={`q_${q.id}`} rows={3} maxLength={1000} placeholder="자유롭게 적어 주세요" />
          )}

          {q.kind === "scale" && (
            <div className="sv-scale">
              {[1, 2, 3, 4, 5].map((v) => (
                <label key={v}>
                  <input type="radio" name={`q_${q.id}`} value={v} />
                  <span>{v}</span>
                </label>
              ))}
            </div>
          )}

          {(q.kind === "single" || q.kind === "multi") && (
            <div className="sv-opts">
              {q.options.map((o, idx) => (
                <label key={o}>
                  <input
                    type={q.kind === "single" ? "radio" : "checkbox"}
                    name={`q_${q.id}`}
                    value={idx}
                  />
                  <span>{o}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
      ))}

      {survey.ask_contact && (
        <fieldset className="sv-q">
          <legend>연락처 (선택)</legend>
          <div className="sv-contact">
            <input name="name" placeholder="이름" maxLength={40} />
            <input name="phone" placeholder="연락처" inputMode="numeric" maxLength={13} />
          </div>
          <p className="sv-note">
            답변 내용 확인이나 안내가 필요할 때만 사용하며, 그 외 목적으로 쓰지 않습니다.
          </p>
        </fieldset>
      )}

      {state.error && <p className="sv-err">{state.error}</p>}

      <button type="submit" disabled={pending}>
        {pending ? "제출 중…" : "제출하기"}
      </button>
    </form>
  );
}
