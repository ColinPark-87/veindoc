/** Red team — 익명(공개 키)으로 실제 공격을 시도해서 RLS 가 정말 막는지 본다.
 *
 *  node scripts/redteam.mjs
 *
 *  RLS 는 "정책을 썼다"로 끝나지 않는다. 정책이 의도대로 도는지는 눌러 봐야 안다.
 *  여기서 하는 것은 전부 읽기/쓰기 시도이며, 성공하면 그 자체가 결함이다.
 *  쓰기 시도가 통과해 버린 경우를 대비해 만들어진 행은 표시해 둔다(직접 지울 수는 없다).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, ".env.local"), "utf8")
    .split("\n").filter((l) => l.includes("=")).map((l) => l.split(/=(.*)/s).slice(0, 2))
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL.trim().replace(/\/$/, "");
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim();
const H = { apikey: KEY, "Content-Type": "application/json" };

let pass = 0, fail = 0;
const findings = [];

function report(ok, title, detail) {
  if (ok) { pass++; console.log(`  OK   ${title}`); }
  else { fail++; findings.push({ title, detail }); console.log(`  FAIL ${title}\n         ${detail}`); }
}

async function req(method, pathname, body) {
  const res = await fetch(`${URL_}/rest/v1/${pathname}`, {
    method,
    headers: { ...H, Prefer: "return=representation" },
    body: body ? JSON.stringify(body) : undefined,
  });
  let parsed = null;
  const text = await res.text();
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return { status: res.status, body: parsed };
}

/** 표가 실제로 존재하는지 — 없는 표는 "차단됨" 처럼 보여 검사를 헛돌게 만든다 */
const missing = new Set();
async function exists(table) {
  const r = await req("GET", `${table}?select=*&limit=0`);
  const gone = r.body && !Array.isArray(r.body) && String(r.body.code) === "PGRST205";
  if (gone) missing.add(table);
  return !gone;
}

/** 익명이 읽으면 안 되는 표 — 행이 하나라도 나오면 유출이다 */
async function mustNotRead(table, why) {
  if (!(await exists(table))) {
    fail++;
    findings.push({ title: `표 없음: ${table}`, detail: "마이그레이션 미적용 — 이 항목은 검사되지 않았다" });
    console.log(`  SKIP ${table} — 표가 없어 검사 못 함(마이그레이션 확인 필요)`);
    return;
  }
  const r = await req("GET", `${table}?select=*&limit=1`);
  const leaked = Array.isArray(r.body) && r.body.length > 0;
  report(!leaked, `읽기 차단: ${table}`, leaked ? `${why} — ${r.body.length}행이 익명에게 노출됨` : "");
}

/** 익명이 써서는 안 되는 표 */
async function mustNotWrite(table, row, why) {
  if (!(await exists(table))) {
    fail++;
    findings.push({ title: `표 없음: ${table}`, detail: "마이그레이션 미적용 — 이 항목은 검사되지 않았다" });
    console.log(`  SKIP ${table} — 표가 없어 검사 못 함(마이그레이션 확인 필요)`);
    return;
  }
  const r = await req("POST", table, row);
  const wrote = r.status === 201 || (Array.isArray(r.body) && r.body.length > 0);
  report(!wrote, `쓰기 차단: ${table}`, wrote ? `${why} — 익명 INSERT 가 통과함(status ${r.status})` : "");
  if (wrote) findings.push({ title: `남은 행 정리 필요: ${table}`, detail: JSON.stringify(r.body).slice(0, 200) });
}

async function mustNotUpdate(table, patch, why) {
  const r = await req("PATCH", `${table}?id=not.is.null`, patch);
  const changed = Array.isArray(r.body) && r.body.length > 0;
  report(!changed, `수정 차단: ${table}`, changed ? `${why} — 익명 UPDATE 가 ${r.body.length}행을 바꿈` : "");
}

async function mustNotDelete(table, why) {
  const r = await req("DELETE", `${table}?id=not.is.null`);
  const deleted = Array.isArray(r.body) && r.body.length > 0;
  report(!deleted, `삭제 차단: ${table}`, deleted ? `${why} — 익명 DELETE 가 ${r.body.length}행을 지움` : "");
}

console.log("\n── 1. 환자·진료 정보 (의료정보) ─────────────────────────");
await mustNotRead("patients", "환자 이름·전화번호·메모");
await mustNotRead("appointments", "예약자 이름·전화번호·진료 기록");
await mustNotRead("sms_logs", "환자에게 보낸 문자 내용과 번호");
await mustNotRead("inquiries", "상담 신청자 연락처");
await mustNotRead("v_patient_timeline", "환자 누적 이력 뷰");
await mustNotRead("v_today_appointments", "오늘 진료 대상 뷰");

console.log("\n── 2. 운영·직원 정보 ────────────────────────────────────");
await mustNotRead("profiles", "직원 계정 목록");
await mustNotRead("activity_logs", "직원 작업 기록");
await mustNotRead("edit_locks", "누가 무엇을 편집 중인지");
await mustNotRead("v_staff_activity", "직원 실적 뷰");
await mustNotRead("page_views", "방문 로그");
await mustNotRead("click_events", "클릭 로그");
await mustNotRead("v_daily_traffic", "일별 트래픽 뷰");
await mustNotRead("v_click_summary", "클릭 집계 뷰");
await mustNotRead("holiday_syncs", "공휴일 동기화 이력");

console.log("\n── 3. 익명 쓰기 시도 ────────────────────────────────────");
await mustNotWrite("patients", { name: "RT침입", phone: "01000000001" }, "환자를 임의로 만들 수 있으면 안 된다");
await mustNotWrite("profiles", { email: "rt@x.kr", role: "admin" }, "스스로 관리자 계정을 만들 수 있으면 치명적");
await mustNotWrite("sms_logs", { to_phone: "01000000002", body: "RT" }, "익명이 문자 큐에 넣으면 스팸 통로");
await mustNotWrite("holidays", { day: "2099-01-01", name: "RT" }, "공휴일 위조");
await mustNotWrite("activity_logs", { action: "rt.forge" }, "감사 로그 위조");
await mustNotWrite("edit_locks", { entity: "appointments", entity_id: "rt", actor: "00000000-0000-0000-0000-000000000000", expires_at: "2099-01-01" }, "남의 편집 잠금 탈취");
await mustNotWrite("surveys", { slug: "rt", title: "RT" }, "설문 위조");
await mustNotWrite("survey_questions", { survey_id: "00000000-0000-0000-0000-000000000000", label: "RT" }, "문항 위조");

console.log("\n── 4. 익명 수정·삭제 시도 ───────────────────────────────");
await mustNotUpdate("appointments", { memo: "RT" }, "예약 변조");
await mustNotUpdate("profiles", { role: "admin" }, "권한 상승");
await mustNotUpdate("reviews", { title: "RT" }, "후기 변조");
await mustNotDelete("reviews", "후기 삭제");
await mustNotDelete("inquiries", "상담 요청 삭제");

console.log("\n── 5. 설문 — 공개 범위가 의도대로인지 ───────────────────");
{
  const r = await req("GET", "surveys?select=id,slug,status&limit=50");
  const rows = Array.isArray(r.body) ? r.body : [];
  const nonOpen = rows.filter((s) => s.status !== "open");
  report(nonOpen.length === 0, "초안·마감 설문은 익명에게 안 보임",
    nonOpen.length ? `status=${nonOpen.map((s) => s.status).join(",")} 인 설문 ${nonOpen.length}건 노출` : "");

  const q = await req("GET", "survey_questions?select=id,survey_id&limit=50");
  const qs = Array.isArray(q.body) ? q.body : [];
  const openIds = new Set(rows.filter((s) => s.status === "open").map((s) => s.id));
  const orphan = qs.filter((x) => !openIds.has(x.survey_id));
  report(orphan.length === 0, "열리지 않은 설문의 문항은 안 보임",
    orphan.length ? `${orphan.length}개 문항이 노출됨` : "");

  await mustNotRead("survey_responses", "설문 응답(이름·연락처가 섞일 수 있음)");

  // 닫힌 설문에 응답을 밀어 넣을 수 있는가
  const closed = rows.find((s) => s.status !== "open");
  if (closed) {
    const w = await req("POST", "survey_responses", { survey_id: closed.id, answers: {} });
    const ok = !(w.status === 201 || (Array.isArray(w.body) && w.body.length));
    report(ok, "닫힌 설문에는 응답 못 넣음", ok ? "" : "닫힌 설문에 익명 응답이 들어감");
  } else {
    console.log("  --   닫힌 설문이 없어 건너뜀");
  }
}

console.log("\n── 6. 공개되어야 하는 것은 실제로 열려 있는가 ───────────");
{
  const r = await req("GET", "reviews?select=id&limit=1");
  report(Array.isArray(r.body), "후기 공개 읽기 동작", Array.isArray(r.body) ? "" : `막힘: ${JSON.stringify(r.body)}`);
  const h = await req("GET", "holidays?select=day&limit=1");
  report(Array.isArray(h.body), "공휴일 공개 읽기 동작", Array.isArray(h.body) ? "" : `막힘: ${JSON.stringify(h.body)}`);
}

console.log(`\n${"─".repeat(56)}`);
console.log(`통과 ${pass} · 실패 ${fail}`);
if (missing.size) console.log(`검사 못 한 표: ${[...missing].join(", ")}`);
if (findings.length) {
  console.log("\n조치 필요:");
  for (const f of findings) console.log(`  · ${f.title}\n    ${f.detail}`);
}
process.exit(fail ? 1 : 0);
