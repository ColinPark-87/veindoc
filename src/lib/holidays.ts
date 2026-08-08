/** 공휴일 — 관보 기준(한국천문연구원 특일 정보). 네이버 캘린더가 따르는 것과 같은 원천.
 *
 *  음력에서 오는 설·추석·부처님오신날과 대체공휴일은 계산이 아니라 '고시'라서
 *  임의로 지어내면 안 된다. 그래서 원천 API 를 끌어오는 것이 정본이고,
 *  키가 없을 때의 폴백은 날짜가 고정된 것만 채운다(모자란 부분은 화면에 표시).
 */

/** 캘린더가 다루는 10년: 작년 ~ 8년 뒤 */
export function holidayYears(base = new Date()): number[] {
  const y = base.getFullYear();
  return Array.from({ length: 10 }, (_, i) => y - 1 + i);
}

export type HolidayRow = {
  day: string; // YYYY-MM-DD
  name: string;
  is_holiday: boolean;
  source: "kasi" | "fixed";
};

/** 날짜가 고정된 공휴일만 — 폴백용. 음력 기반은 여기에 넣지 않는다(지어내면 오답) */
export function fixedHolidays(year: number): HolidayRow[] {
  const F: [string, string][] = [
    ["01-01", "1월 1일"],
    ["03-01", "삼일절"],
    ["05-05", "어린이날"],
    ["06-06", "현충일"],
    ["08-15", "광복절"],
    ["10-03", "개천절"],
    ["10-09", "한글날"],
    ["12-25", "기독탄신일"],
  ];
  return F.map(([md, name]) => ({
    day: `${year}-${md}`,
    name,
    is_holiday: true,
    source: "fixed" as const,
  }));
}

const KASI =
  "https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo";

/** 한 해치를 원천에서 끌어온다. 실패하면 null(호출부가 실패 연도로 기록) */
export async function fetchKasiYear(
  year: number,
  serviceKey: string
): Promise<HolidayRow[] | null> {
  const url =
    `${KASI}?solYear=${year}&numOfRows=100&_type=json` +
    `&ServiceKey=${encodeURIComponent(serviceKey)}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;

    // 오류일 때 XML 을 돌려주는 API 라 파싱 실패도 실패로 취급한다
    const json = await res.json().catch(() => null);
    const body = json?.response?.body;
    if (!body) return null;

    const raw = body.items?.item;
    if (raw == null) return []; // 그 해에 고시된 항목이 없다(정상 응답)
    const items = Array.isArray(raw) ? raw : [raw];

    return items.flatMap((it: Record<string, unknown>) => {
      const d = String(it.locdate ?? "");
      if (!/^\d{8}$/.test(d)) return [];
      return [
        {
          day: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
          name: String(it.dateName ?? "").trim() || "공휴일",
          is_holiday: String(it.isHoliday ?? "Y").toUpperCase() === "Y",
          source: "kasi" as const,
        },
      ];
    });
  } catch {
    return null;
  }
}

/** 토=파랑, 일·공휴일=빨강 */
export type DayTone = "sat" | "sun" | "holiday" | "";

export function dayTone(date: Date, isHoliday: boolean): DayTone {
  if (isHoliday) return "holiday";
  const d = date.getDay();
  return d === 0 ? "sun" : d === 6 ? "sat" : "";
}

/** 로컬 기준 YYYY-MM-DD (toISOString 은 UTC 로 밀려 하루 어긋난다) */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** 그 달 격자(월요일 시작 6주)를 만든다 — 앞뒤 달 날짜 포함 */
export function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month - 1, 1);
  const lead = (first.getDay() + 6) % 7; // 월요일 시작
  const start = new Date(year, month - 1, 1 - lead);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}
