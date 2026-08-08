import SiteHeader from "@/components/SiteHeader";
import ReviewDeck from "@/components/ReviewDeck";
import ReviewGate from "@/components/ReviewGate";
import { createClient } from "@/lib/supabase-server";
import type { Review } from "@/lib/reviews";
import { signOut } from "./actions";

export const metadata = { title: "치료후기 | 삼성흉부외과 대전" };
/** 세션에 따라 결과가 달라지므로 정적 캐시 금지 */
export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <>
        <SiteHeader active="reviews" />
        <ReviewGate />
      </>
    );
  }

  // 원본이 대전·평촌·천안 3지점 공용 게시판이라 글별 지점 구분이 없다.
  // 지점 필터 없이 전량 노출하고, UI에서 "3지점 공용"임을 명시한다.
  const { data, count } = await supabase
    .from("reviews")
    .select("id,title,body,views,created_at", { count: "exact" })
    .order("views", { ascending: false })
    .limit(60);

  return (
    <>
      <SiteHeader active="reviews" />
      <ReviewDeck
        reviews={(data ?? []) as Review[]}
        total={count ?? (data?.length ?? 0)}
        source="supabase"
        signOutAction={signOut}
        email={user.email ?? ""}
      />
    </>
  );
}
