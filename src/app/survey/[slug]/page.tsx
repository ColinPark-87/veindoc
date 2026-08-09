import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { createClient } from "@/lib/supabase-server";
import type { Question, Survey } from "@/lib/surveys";
import SurveyForm from "../SurveyForm";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  const supabase = await createClient();
  // RLS 상 열려 있지 않은 설문은 익명에게 아예 보이지 않는다
  const { data: survey } = await supabase
    .from("surveys")
    .select("id,slug,title,intro,status,ask_contact,thanks")
    .eq("slug", slug)
    .maybeSingle();
  if (!survey) return null;

  const { data: qs } = await supabase
    .from("survey_questions")
    .select("id,ord,kind,label,options,required")
    .eq("survey_id", survey.id)
    .order("ord");

  return { survey: survey as Survey, questions: (qs ?? []) as Question[] };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const found = await load(slug);
  return {
    title: found ? `${found.survey.title} | 삼성흉부외과 대전` : "설문 | 삼성흉부외과 대전",
    description: found?.survey.intro || "설문에 참여해 주세요.",
  };
}

export default async function SurveyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const found = await load(slug);
  if (!found) notFound();
  const { survey, questions } = found;

  return (
    <>
      <SiteHeader active="survey" />
      <main className="sv-page">
        <div className="shell sv-narrow">
          <span className="eyebrow">설문</span>
          <h1 className="sv-title">{survey.title}</h1>
          {survey.intro && <p className="sv-intro">{survey.intro}</p>}

          {survey.status !== "open" ? (
            <p className="sv-empty">이 설문은 마감되었습니다.</p>
          ) : questions.length === 0 ? (
            <p className="sv-empty">아직 문항이 준비되지 않았습니다.</p>
          ) : (
            <SurveyForm survey={survey} questions={questions} />
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
