/** 설문 — 타입과 집계.
 *  응답은 한 건당 jsonb 한 덩어리라, 통계는 여기서 한 번에 굴린다. */

export type QKind = "single" | "multi" | "scale" | "text";

export const KIND_LABEL: Record<QKind, string> = {
  single: "단일 선택",
  multi: "복수 선택",
  scale: "5점 척도",
  text: "주관식",
};

export type Question = {
  id: string;
  ord: number;
  kind: QKind;
  label: string;
  options: string[];
  required: boolean;
};

export type Survey = {
  id: string;
  slug: string;
  title: string;
  intro: string;
  status: "draft" | "open" | "closed";
  ask_contact: boolean;
  thanks: string;
};

/** 한 문항에 대한 답 — 종류에 따라 셋 중 하나만 채워진다 */
export type Answer = { choice?: number[]; scale?: number; text?: string };
export type Answers = Record<string, Answer>;

export type Stat =
  | { kind: "single" | "multi"; total: number; rows: { label: string; n: number }[] }
  | { kind: "scale"; total: number; avg: number; rows: { label: string; n: number }[] }
  | { kind: "text"; total: number; texts: string[] };

/** 문항 정의 + 응답 묶음 → 문항별 통계 */
export function tally(questions: Question[], responses: Answers[]): Map<string, Stat> {
  const out = new Map<string, Stat>();

  for (const q of questions) {
    const given = responses
      .map((r) => r[q.id])
      .filter((a): a is Answer => !!a && Object.keys(a).length > 0);

    if (q.kind === "text") {
      const texts = given.map((a) => (a.text ?? "").trim()).filter(Boolean);
      out.set(q.id, { kind: "text", total: texts.length, texts });
      continue;
    }

    if (q.kind === "scale") {
      const nums = given
        .map((a) => Number(a.scale))
        .filter((n) => Number.isFinite(n) && n >= 1 && n <= 5);
      const rows = [1, 2, 3, 4, 5].map((v) => ({
        label: `${v}점`,
        n: nums.filter((n) => n === v).length,
      }));
      const avg = nums.length
        ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10
        : 0;
      out.set(q.id, { kind: "scale", total: nums.length, avg, rows });
      continue;
    }

    // single/multi — 선택지 인덱스로 저장하므로 문항 수정에도 집계가 어긋나지 않는다
    const counts = q.options.map(() => 0);
    let total = 0;
    for (const a of given) {
      const picks = a.choice ?? [];
      if (picks.length === 0) continue;
      total++;
      for (const i of picks) if (i >= 0 && i < counts.length) counts[i]++;
    }
    out.set(q.id, {
      kind: q.kind,
      total,
      rows: q.options.map((label, i) => ({ label, n: counts[i] })),
    });
  }

  return out;
}

/** 제목에서 주소용 slug 를 만든다. 한글은 그대로 쓰면 주소가 지저분해져 음절을 버리고
 *  영문·숫자만 남긴다. 남는 게 없으면 호출부에서 임의 접미사를 붙인다. */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40);
}
