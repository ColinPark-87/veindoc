"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import type { Answers, Question } from "@/lib/surveys";

/** 설문 응답 제출 — 익명이 부르는 자리다.
 *
 *  들어온 값을 그대로 믿지 않는다: 문항 정의를 DB 에서 다시 읽어
 *  존재하는 문항·범위 안의 선택지만 남긴다. 그러지 않으면 아무 값이나 섞여
 *  통계가 조용히 오염된다. 설문이 'open' 이 아니면 RLS 가 먼저 막는다. */
export async function submitSurvey(
  _prev: { ok?: boolean; error?: string },
  form: FormData
): Promise<{ ok?: boolean; error?: string }> {
  const slug = String(form.get("slug") ?? "");
  const supabase = await createClient();

  const { data: survey } = await supabase
    .from("surveys")
    .select("id,status,ask_contact")
    .eq("slug", slug)
    .maybeSingle();
  if (!survey || survey.status !== "open") {
    return { error: "지금은 응답을 받지 않는 설문입니다." };
  }

  const { data: qs } = await supabase
    .from("survey_questions")
    .select("id,ord,kind,label,options,required")
    .eq("survey_id", survey.id)
    .order("ord");
  const questions = (qs ?? []) as Question[];

  const answers: Answers = {};
  for (const q of questions) {
    if (q.kind === "text") {
      const v = String(form.get(`q_${q.id}`) ?? "").trim().slice(0, 1000);
      if (v) answers[q.id] = { text: v };
    } else if (q.kind === "scale") {
      const n = Number(form.get(`q_${q.id}`));
      if (Number.isFinite(n) && n >= 1 && n <= 5) answers[q.id] = { scale: n };
    } else {
      const picked = form
        .getAll(`q_${q.id}`)
        .map((v) => Number(v))
        .filter((n) => Number.isInteger(n) && n >= 0 && n < q.options.length);
      const choice = q.kind === "single" ? picked.slice(0, 1) : [...new Set(picked)];
      if (choice.length) answers[q.id] = { choice };
    }

    if (q.required && !answers[q.id]) {
      return { error: `필수 문항에 답해 주세요: ${q.label}` };
    }
  }

  if (questions.length === 0) return { error: "문항이 없는 설문입니다." };

  const { error } = await supabase.from("survey_responses").insert({
    survey_id: survey.id,
    answers,
    // 그때의 문항을 함께 남긴다 — 나중에 문항을 고쳐도 이 응답의 의미가 보존된다
    snapshot: questions.map((q) => ({ id: q.id, label: q.label, kind: q.kind, options: q.options })),
    name: survey.ask_contact ? String(form.get("name") ?? "").trim().slice(0, 40) : "",
    phone: survey.ask_contact
      ? String(form.get("phone") ?? "").replace(/[^0-9]/g, "").slice(0, 11)
      : "",
    branch: "대전",
  });
  if (error) return { error: "제출하지 못했습니다. 잠시 후 다시 시도해 주세요." };

  revalidatePath(`/survey/${slug}`);
  return { ok: true };
}
