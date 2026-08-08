/**
 * 치료후기 데이터 소스.
 * Supabase 환경변수가 있으면 DB에서, 없으면 샘플로 폴백한다.
 * (원본 사이트에서 942건을 수집해 두었고, 마이그레이션 후 DB가 정본이 된다)
 */
export type Review = {
  id: string | number;
  title: string;
  body: string;
  views: number;
  created_at?: string | null;
};

const SAMPLE: Review[] = [
  { id: 1, title: "다리에 쥐가 나고 아팠는데…", views: 1535, body: "밤마다 종아리에 쥐가 나서 잠을 못 잤습니다. 수술 후 첫날부터 그 느낌이 없어졌어요." },
  { id: 2, title: "여름에 반바지를 입을 수 있게 되었어요!", views: 2477, body: "10년 넘게 긴 바지만 입었습니다. 올여름은 처음으로 반바지를 입었습니다." },
  { id: 3, title: "수술에 대한 불안감은 떨치고…", views: 1409, body: "흉터가 걱정이었는데 지금은 어디를 했는지 저도 못 찾습니다." },
  { id: 4, title: "레이저 수술을 하였습니다", views: 6, body: "당일 걸어서 나왔고 다음 날 출근했습니다." },
  { id: 5, title: "아픈 증상이 사라졌어요", views: 1, body: "오래 서 있는 일을 하는데 퇴근 후 다리가 터질 것 같았습니다. 지금은 훨씬 가볍습니다." },
  { id: 6, title: "금방 끝나고 아프지 않아요", views: 8, body: "생각보다 시간이 짧았고 통증도 걱정한 것보다 덜했습니다." },
];

export async function getReviews(): Promise<{
  reviews: Review[];
  total: number;
  source: "supabase" | "sample";
}> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return { reviews: SAMPLE, total: 942, source: "sample" };

  // 레거시 anon 키(JWT)는 Bearer 를 함께 보내야 하지만,
  // 새 publishable 키(sb_publishable_…)는 apikey 헤더만 사용한다.
  const headers: Record<string, string> = { apikey: key };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;

  try {
    const res = await fetch(
      `${url}/rest/v1/reviews?select=id,title,body,views,created_at&order=views.desc&limit=24`,
      { headers, next: { revalidate: 300 } }
    );
    if (!res.ok) throw new Error(`supabase ${res.status}`);
    const reviews = (await res.json()) as Review[];
    const total = Number(res.headers.get("content-range")?.split("/")[1]) || reviews.length;
    return { reviews, total, source: "supabase" };
  } catch {
    // 연결 전이거나 일시 장애면 샘플로 계속 서비스
    return { reviews: SAMPLE, total: 942, source: "sample" };
  }
}
