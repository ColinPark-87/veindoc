/** 설문 집계 자체 점검 — node scripts/test_surveys.mjs
 *
 *  통계는 틀려도 화면에는 그럴듯한 막대가 그려진다. 조용히 어긋나는 자리라 검사를 남긴다. */
import assert from "node:assert/strict";
import { tally, slugify } from "../src/lib/surveys.ts";

const Q = [
  { id: "q1", ord: 1, kind: "single", label: "단일", options: ["A", "B", "C"], required: true },
  { id: "q2", ord: 2, kind: "multi", label: "복수", options: ["X", "Y"], required: false },
  { id: "q3", ord: 3, kind: "scale", label: "척도", options: [], required: true },
  { id: "q4", ord: 4, kind: "text", label: "주관식", options: [], required: false },
];

const R = [
  { q1: { choice: [0] }, q2: { choice: [0, 1] }, q3: { scale: 5 }, q4: { text: "좋아요" } },
  { q1: { choice: [0] }, q2: { choice: [1] }, q3: { scale: 3 }, q4: { text: "  " } },
  { q1: { choice: [2] }, q3: { scale: 4 } },
  {}, // 아무것도 안 낸 응답
];

const s = tally(Q, R);

// ── 단일 선택: 응답한 사람 수와 선택지별 수
const q1 = s.get("q1");
assert.equal(q1.kind, "single");
assert.equal(q1.total, 3, "q1 응답 수");
assert.deepEqual(q1.rows.map((r) => r.n), [2, 0, 1], "q1 선택지별");

// ── 복수 선택: 한 사람이 둘 고르면 총계는 1명, 선택지는 각각 +1
const q2 = s.get("q2");
assert.equal(q2.total, 2, "q2 응답한 사람 수(선택 개수가 아니다)");
assert.deepEqual(q2.rows.map((r) => r.n), [1, 2], "q2 선택지별");

// ── 척도: 분포와 평균
const q3 = s.get("q3");
assert.equal(q3.total, 3);
assert.deepEqual(q3.rows.map((r) => r.n), [0, 0, 1, 1, 1], "1~5점 분포");
assert.equal(q3.avg, 4, "(5+3+4)/3 = 4");

// ── 주관식: 공백만 있는 답은 세지 않는다
const q4 = s.get("q4");
assert.equal(q4.kind, "text");
assert.equal(q4.total, 1, "공백 응답 제외");
assert.deepEqual(q4.texts, ["좋아요"]);

// ── 범위 밖 인덱스는 무시한다(제출 시 걸러지지만 과거 데이터 방어)
const bad = tally([Q[0]], [{ q1: { choice: [9] } }, { q1: { choice: [-1] } }]);
assert.deepEqual(bad.get("q1").rows.map((r) => r.n), [0, 0, 0], "범위 밖 선택지 무시");

// ── 문항이 늘어도 과거 응답이 깨지지 않는다
const grown = [...Q, { id: "q5", ord: 5, kind: "single", label: "새 문항", options: ["P", "Q"], required: false }];
const g = tally(grown, R);
assert.equal(g.get("q5").total, 0, "새 문항은 응답 0");
assert.equal(g.get("q1").total, 3, "기존 문항 집계는 그대로");

// ── 척도 범위 밖 값
const sc = tally([Q[2]], [{ q3: { scale: 0 } }, { q3: { scale: 6 } }, { q3: { scale: 2 } }]);
assert.equal(sc.get("q3").total, 1, "1~5 밖은 버린다");
assert.equal(sc.get("q3").avg, 2);

// ── slug
assert.equal(slugify("Patient Satisfaction 2026"), "patient-satisfaction-2026");
assert.ok(slugify("만족도 조사").length > 0, "한글도 빈 문자열이 되지 않는다");
assert.ok(!slugify("a/b?c#d").includes("/"), "주소에 못 쓰는 문자 제거");

console.log("surveys: 모든 검사 통과");
