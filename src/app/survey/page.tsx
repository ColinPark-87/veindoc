import Link from "next/link";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "설문 | 삼성흉부외과 대전",
  description: "진행 중인 설문에 참여해 주세요.",
};

export default async function SurveyIndex() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("surveys")
    .select("slug,title,intro")
    .eq("status", "open")
    .order("created_at", { ascending: false });

  const open = data ?? [];

  return (
    <>
      <SiteHeader active="survey" />
      <main className="sv-page">
        <div className="shell">
          <span className="eyebrow">설문</span>
          <h1 className="sv-title">진행 중인 설문</h1>

          {open.length === 0 ? (
            <p className="sv-empty">
              지금은 진행 중인 설문이 없습니다. 새 설문이 열리면 이 자리에 표시됩니다.
            </p>
          ) : (
            <ul className="sv-list">
              {open.map((s) => (
                <li key={s.slug}>
                  <Link href={`/survey/${s.slug}`}>
                    <b>{s.title}</b>
                    {s.intro && <span>{s.intro}</span>}
                    <em>참여하기</em>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
