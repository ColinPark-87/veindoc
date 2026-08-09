"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getMe, isStaff, isAdmin, logActivity } from "@/lib/auth";
import { guard } from "@/lib/notice";
import { slugify, type QKind } from "@/lib/surveys";

const KINDS: QKind[] = ["single", "multi", "scale", "text"];

function revalidateSurveys(id?: string) {
  revalidatePath("/admin/surveys");
  if (id) revalidatePath(`/admin/surveys/${id}`);
  revalidatePath("/survey");
}

export async function createSurvey(form: FormData) {
  await guard(async () => {
    const me = await getMe();
    if (!isStaff(me)) throw new Error("권한 없음");

    const title = String(form.get("title") ?? "").trim();
    if (!title) return;

    const supabase = await createClient();
    // 한글 제목이면 slug 가 비거나 겹치기 쉬워 짧은 접미사를 붙여 항상 유일하게 만든다
    const base = slugify(title) || "survey";
    const slug = `${base}-${Math.abs(hash(title + String(form.get("nonce") ?? ""))) % 46656}`;

    const { data, error } = await supabase
      .from("surveys")
      .insert({
        title,
        slug,
        intro: String(form.get("intro") ?? ""),
        ask_contact: form.get("ask_contact") === "on",
        created_by: me!.id,
      })
      .select("id")
      .single();
    if (error) throw new Error(`설문 생성 실패: ${error.message}`);

    await logActivity("survey.create", "surveys", data?.id, { title });
    revalidateSurveys();
    redirect(`/admin/surveys/${data!.id}`);
  });
}

export async function updateSurvey(form: FormData) {
  await guard(async () => {
    const me = await getMe();
    if (!isStaff(me)) throw new Error("권한 없음");

    const id = String(form.get("id"));
    const status = String(form.get("status") ?? "draft");
    if (!["draft", "open", "closed"].includes(status)) return;

    const supabase = await createClient();
    const { error } = await supabase
      .from("surveys")
      .update({
        title: String(form.get("title") ?? "").trim(),
        intro: String(form.get("intro") ?? ""),
        thanks: String(form.get("thanks") ?? ""),
        ask_contact: form.get("ask_contact") === "on",
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw new Error(`저장 실패: ${error.message}`);

    await logActivity("survey.update", "surveys", id, { status });
    revalidateSurveys(id);
  }, "설문을 저장했습니다.");
}

export async function addQuestion(form: FormData) {
  await guard(async () => {
    const me = await getMe();
    if (!isStaff(me)) throw new Error("권한 없음");

    const survey_id = String(form.get("survey_id"));
    const kind = String(form.get("kind")) as QKind;
    const label = String(form.get("label") ?? "").trim();
    if (!label || !KINDS.includes(kind)) return;

    // 줄바꿈으로 선택지를 받는다 — 관리 화면에서 가장 손이 덜 간다
    const options = String(form.get("options") ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if ((kind === "single" || kind === "multi") && options.length < 2) {
      throw new Error("선택형 문항은 선택지를 두 개 이상 적어 주세요.");
    }

    const supabase = await createClient();
    const { data: last } = await supabase
      .from("survey_questions")
      .select("ord")
      .eq("survey_id", survey_id)
      .order("ord", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await supabase.from("survey_questions").insert({
      survey_id,
      ord: (last?.ord ?? 0) + 1,
      kind,
      label,
      options,
      required: form.get("required") === "on",
    });
    if (error) throw new Error(`문항 추가 실패: ${error.message}`);

    await logActivity("survey.question", "surveys", survey_id, { kind });
    revalidateSurveys(survey_id);
  }, "문항을 추가했습니다.");
}

export async function deleteQuestion(form: FormData) {
  await guard(async () => {
    const me = await getMe();
    if (!isStaff(me)) throw new Error("권한 없음");

    const id = String(form.get("id"));
    const survey_id = String(form.get("survey_id"));
    const supabase = await createClient();
    const { error } = await supabase.from("survey_questions").delete().eq("id", id);
    if (error) throw new Error(`삭제 실패: ${error.message}`);

    await logActivity("survey.question.delete", "surveys", survey_id);
    revalidateSurveys(survey_id);
  }, "문항을 삭제했습니다.");
}

export async function moveQuestion(form: FormData) {
  await guard(async () => {
    const me = await getMe();
    if (!isStaff(me)) throw new Error("권한 없음");

    const id = String(form.get("id"));
    const survey_id = String(form.get("survey_id"));
    const dir = String(form.get("dir")) === "up" ? -1 : 1;

    const supabase = await createClient();
    const { data: qs } = await supabase
      .from("survey_questions")
      .select("id,ord")
      .eq("survey_id", survey_id)
      .order("ord");
    const list = qs ?? [];
    const i = list.findIndex((q) => q.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;

    // 두 행의 ord 를 맞바꾼다
    await supabase.from("survey_questions").update({ ord: list[j].ord }).eq("id", list[i].id);
    await supabase.from("survey_questions").update({ ord: list[i].ord }).eq("id", list[j].id);

    revalidateSurveys(survey_id);
  });
}

export async function deleteSurvey(form: FormData) {
  await guard(async () => {
    const me = await getMe();
    if (!isAdmin(me)) throw new Error("관리자만 삭제할 수 있습니다");

    const id = String(form.get("id"));
    const supabase = await createClient();
    const { error } = await supabase.from("surveys").delete().eq("id", id);
    if (error) throw new Error(`삭제 실패: ${error.message}`);

    await logActivity("survey.delete", "surveys", id);
    revalidateSurveys();
  }, "설문을 삭제했습니다.");
}

/** 제목에서 안정적인 짧은 수를 뽑는다(같은 제목이면 같은 slug) */
function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h | 0;
}
