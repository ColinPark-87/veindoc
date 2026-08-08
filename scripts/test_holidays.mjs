/** 캘린더 날짜 계산 자체 점검 — node scripts/test_holidays.mjs
 *  격자/요일색/날짜문자열은 눈으로는 맞아 보이고 조용히 틀리는 자리라 검사를 남긴다.
 *  Node 는 .ts 를 그대로 읽는다(타입 스트리핑). 별도 빌드 불필요. */
import assert from "node:assert/strict";
import {
  ymd,
  monthGrid,
  dayTone,
  holidayYears,
  fixedHolidays,
} from "../src/lib/holidays.ts";

// ── ymd: UTC 로 밀려 하루 어긋나면 안 된다
assert.equal(ymd(new Date(2026, 0, 1)), "2026-01-01");
assert.equal(ymd(new Date(2026, 11, 31)), "2026-12-31");

// ── monthGrid: 월요일 시작 6주 = 42칸, 첫 칸은 항상 월요일
for (const [y, m] of [[2026, 2], [2026, 8], [2027, 3], [2024, 2]]) {
  const g = monthGrid(y, m);
  assert.equal(g.length, 42, `${y}-${m} 칸 수`);
  assert.equal(g[0].getDay(), 1, `${y}-${m} 첫 칸이 월요일`);
  assert.ok(g.some((d) => d.getMonth() === m - 1 && d.getDate() === 1), `${y}-${m} 1일 포함`);
  const lastDay = new Date(y, m, 0).getDate();
  assert.ok(g.some((d) => d.getMonth() === m - 1 && d.getDate() === lastDay), `${y}-${m} 말일 포함`);
}

// ── 요일 색: 토=파랑, 일=빨강, 공휴일은 요일보다 우선
assert.equal(dayTone(new Date(2026, 7, 8), false), "sat"); // 토
assert.equal(dayTone(new Date(2026, 7, 9), false), "sun"); // 일
assert.equal(dayTone(new Date(2026, 7, 10), false), "");   // 월
assert.equal(dayTone(new Date(2026, 7, 10), true), "holiday");
assert.equal(dayTone(new Date(2026, 7, 8), true), "holiday");

// ── 10년 범위
const ys = holidayYears(new Date(2026, 0, 1));
assert.equal(ys.length, 10);
assert.equal(ys[0], 2025);
assert.equal(ys[9], 2034);

// ── 폴백은 날짜 고정 공휴일만(음력 기반을 지어내지 않는다)
const fx = fixedHolidays(2026);
assert.equal(fx.length, 8);
assert.ok(fx.every((h) => h.day.startsWith("2026-") && h.source === "fixed"));
assert.ok(!fx.some((h) => /설|추석|부처님/.test(h.name)));

console.log("holidays: 모든 검사 통과");
