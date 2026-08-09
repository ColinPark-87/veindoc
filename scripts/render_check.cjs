/** 관리자 페이지 렌더 검사 — node scripts/render_check.cjs
 *
 *  관리자 화면은 로그인 뒤에만 보이므로 브라우저로 열어보려면 사람이 필요하다.
 *  대신 앱 코드는 그대로 두고 Supabase 클라이언트와 인증만 가짜로 바꿔 끼운 뒤
 *  서버 컴포넌트를 직접 실행해서, 실제로 그려지는지와 화면에 나와야 할 것이
 *  나오는지를 본다. 데이터가 있을 때와 없을 때를 모두 돌린다.
 *
 *  검사에만 쓰는 장치다. 앱에는 인증 우회가 없다. */
const { execSync } = require("child_process");
const fs = require("fs");
const Module = require("module");
const path = require("path");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const ROOT = path.join(__dirname, "..");
const BUILD = path.join(ROOT, ".render-check");
const OUT = path.join(BUILD, "src");
const APP = path.join(OUT, "app", "admin", "(protected)");

// TSX 를 그대로는 못 읽으니 검사 전에 한 번 트랜스파일한다(.render-check/ 는 git 무시)
if (!fs.existsSync(APP) || process.argv.includes("--rebuild")) {
  execSync(
    `npx tsc -p tsconfig.json --outDir ${JSON.stringify(BUILD)} --module commonjs ` +
      `--moduleResolution node --jsx react-jsx --target es2022 --noEmit false ` +
      `--declaration false --skipLibCheck --esModuleInterop`,
    { cwd: ROOT, stdio: "inherit" }
  );
}

// ── 픽스처 ────────────────────────────────────────────────
const NOW = new Date("2026-08-09T10:00:00+09:00");
const iso = (h) => new Date(NOW.getTime() + h * 3600e3).toISOString();

const FIXTURES = {
  appointments: [
    { id: "a1", name: "김철수", phone: "01012345678", patient_id: "p1", preferred_at: iso(-1),
      status: "done", arrived_at: iso(-1), doctor: "차대원", day_note: "레이저 1차", next_at: iso(24 * 30),
      memo: "재진", branch: "대전", symptoms: ["다리 무거움"], source: "phone", created_at: iso(-48) },
    { id: "a2", name: "이영희", phone: "01099998888", patient_id: null, preferred_at: iso(2),
      status: "confirmed", arrived_at: null, doctor: "", day_note: "", next_at: null,
      memo: "", branch: "대전", symptoms: [], source: "web", created_at: iso(-3) },
  ],
  patients: [
    { id: "p1", name: "김철수", phone: "01012345678", branch: "대전", doctor: "차대원",
      memo: "고혈압", first_seen: iso(-800), last_seen: iso(-1), created_at: iso(-800) },
    { id: "p2", name: "김철수", phone: "01055556666", branch: "대전", doctor: "",
      memo: "", first_seen: iso(-40), last_seen: null, created_at: iso(-40) },
  ],
  holidays: [{ day: "2026-08-15", name: "광복절", is_holiday: true }],
  holiday_syncs: [{ created_at: iso(-5), upserted: 80, failed: [2033, 2034], source: "fixed" }],
  profiles: [
    { id: "u1", email: "admin@x.kr", name: "관리자", role: "admin", branch: "대전", is_active: true, created_at: iso(-100) },
    { id: "u2", email: "new@x.kr", name: null, role: "member", branch: "대전", is_active: true, created_at: iso(-24) },
  ],
  activity_logs: [
    { id: 1, actor: "u1", action: "appointment.arrival", entity: "appointments", entity_id: "a1",
      created_at: iso(-2), profiles: { name: "관리자", email: "admin@x.kr" } },
  ],
  page_views: [{ path: "/", device: "mobile", session_id: "s1", created_at: iso(-2) }],
  click_events: [{ target: "talktalk", created_at: iso(-2) }],
  sms_logs: [{ id: "s1", to_phone: "01012345678", body: "안내", template: "진료안내",
    branch: "대전", status: "queued", error: null, created_at: iso(-2) }],
  inquiries: [{ id: "i1", name: "약도 요청", phone: "01011112222", message: "대전 약도 문자 요청",
    symptoms: [], branch: "대전", kind: "map_sms", handled_at: null, created_at: iso(-1) }],
  v_staff_activity: [{ id: "u1", name: "관리자", email: "admin@x.kr", role: "admin",
    actions: 12, actions_7d: 5, last_at: iso(-2) }],
  edit_locks: [{ entity_id: "a1", actor: "u9", actor_name: "박간호",
    expires_at: new Date(Date.parse("2026-08-09T10:00:00+09:00") + 120000).toISOString() }],
  reviews: [], posts: [], clinic_settings: [],
};

let EMPTY = false;
const rowsFor = (t) => (EMPTY ? [] : FIXTURES[t] ?? []);

/** supabase-js 의 체이닝을 흉내낸다 — 어떤 순서로 불러도 마지막에 then 으로 결과를 준다 */
function query(table) {
  const q = {
    then: (res) => Promise.resolve({ data: rowsFor(table), error: null, count: rowsFor(table).length }).then(res),
    maybeSingle: async () => ({ data: rowsFor(table)[0] ?? null, error: null }),
    single: async () => ({ data: rowsFor(table)[0] ?? null, error: null }),
  };
  for (const m of ["select", "eq", "neq", "gt", "gte", "lte", "is", "in", "or", "ilike", "order", "limit", "filter", "not"]) {
    q[m] = () => q;
  }
  return q;
}

const fakeClient = {
  from: (t) => query(t),
  rpc: async () => ({ data: "p1", error: null }),
  auth: { getUser: async () => ({ data: { user: { id: "u1", email: "admin@x.kr" } } }) },
};

const ME = { id: "u1", email: "admin@x.kr", name: "관리자", role: "admin", branch: "대전" };

// ── 모듈 치환 ─────────────────────────────────────────────
const STUBS = {
  "next/link": { __esModule: true, default: ({ href, children, ...r }) => React.createElement("a", { href, ...r }, children) },
  "next/navigation": {
    redirect: (u) => { throw Object.assign(new Error("REDIRECT"), { redirectTo: u }); },
    notFound: () => { throw Object.assign(new Error("NOT_FOUND"), { notFound: true }); },
  },
  "next/cache": { revalidatePath: () => {} },
};

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (STUBS[request]) return "STUB:" + request;
  if (request.startsWith("@/")) {
    return origResolve.call(this, path.join(OUT, request.slice(2)), parent, ...rest);
  }
  return origResolve.call(this, request, parent, ...rest);
};
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (STUBS[request]) return STUBS[request];
  const m = origLoad.call(this, request, parent, isMain);
  // 인증·DB 는 실제 모듈을 로드한 뒤 함수만 갈아끼운다(앱 코드는 그대로 둔다)
  if (request.endsWith("supabase-server") || request.includes("supabase-server")) {
    return { ...m, createClient: async () => fakeClient };
  }
  if (request.endsWith("/auth") || request.endsWith("lib/auth")) {
    return { ...m, getMe: async () => ME, isAdmin: () => true, isStaff: () => true, logActivity: async () => {} };
  }
  return m;
};

// ── 검사 대상 ─────────────────────────────────────────────
/** [이름, 파일, props, 데이터가 있을 때 반드시 화면에 나와야 하는 것들] */
const PAGES = [
  ["대시보드(꺾은선)", "page.js", { searchParams: Promise.resolve({ d: "14", c: "line" }) },
    ["일별 접속자", "adm-chart", "꺾은선", "막대"]],
  ["대시보드(막대)", "page.js", { searchParams: Promise.resolve({ d: "90", c: "bar" }) },
    ["ch-bar", "ch-ytick"]],
  ["진료 캘린더", "calendar/page.js", { searchParams: Promise.resolve({ y: "2026", m: "8", d: "2026-08-09" }) },
    ["cal-day sat", "cal-day sun", "광복절", "공휴일 새로고침", "당일 알림", "내원 체크", "당일 특이 기록", "주치의", "다음 진료",
     "박간호님이 수정 중", "lock-bar", "수정 시작(3분 잠금)"]],
  ["환자 목록", "patients/page.js", { searchParams: Promise.resolve({ q: "" }) },
    ["동명이인", "김철수", "주치의"]],
  ["환자 상세", "patients/[id]/page.js", { params: Promise.resolve({ id: "p1" }) },
    ["이름이 같은 환자가", "진료 이력", "문자 보내기", "다음 진료"]],
  ["예약 관리", "appointments/page.js", { searchParams: Promise.resolve({ s: "", q: "" }) },
    ["환자 연결", "환자로 연결되지 않은 예약", "내원함", "차대원"]],
  ["상담 요청", "inquiries/page.js", { searchParams: Promise.resolve({ v: "open" }) },
    ["약도 문자", "처리 완료", "문자 보내기"]],
  ["계정 관리", "members/page.js", { searchParams: Promise.resolve({ r: "", q: "" }) },
    ["권한 대기", "직원으로", "관리자로", "활성 관리자가 한 명뿐일 때"]],
  ["직원 실적", "staff-activity/page.js", { searchParams: Promise.resolve({ d: "30", c: "bar", who: "" }) },
    ["직원별 처리 건수", "일별 추이", "내원 체크", "ch-bar"]],
  ["알림(직원)", "today/page.js", {},
    ["알림", "내원 완료", "내가 오늘 한 일", "미처리 문의", "오늘 나간 문자"]],
  ["작업 로그", "logs/page.js", { searchParams: Promise.resolve({ d: "2026-08-09", who: "", a: "" }) },
    ["작업 로그", "log-days", "모든 직원", "모든 작업"]],
];

(async () => {
  let fail = 0;
  for (const empty of [false, true]) {
    EMPTY = empty;
    console.log(`\n${"─".repeat(58)}\n${empty ? "② 데이터 없음(빈 상태)" : "① 데이터 있음"}\n${"─".repeat(58)}`);
    for (const [label, file, props, must] of PAGES) {
      let mark = "OK  ", note = "";
      try {
        const mod = require(path.join(APP, file));
        const el = await (mod.default ?? mod)(props);
        const html = renderToStaticMarkup(el);
        if (!html || html.length < 80) throw new Error("렌더 결과가 비어 있음");
        note = `${html.length}자`;

        // 렌더는 됐는데 화면에 에러 문구가 박힌 경우도 잡는다
        if (/불러오지 못했습니다|Error:/.test(html)) { mark = "WARN"; note += " · 화면에 에러 문구"; }

        // 데이터가 있을 때만 내용 검증 — 빈 상태에서는 안 나오는 게 정상
        if (!empty && must) {
          const missing = must.filter((s) => !html.includes(s));
          if (missing.length) { mark = "FAIL"; note += ` · 누락: ${missing.join(", ")}`; fail++; }
        }
      } catch (e) {
        if (e.redirectTo) { note = `redirect → ${e.redirectTo}`; }
        else if (e.notFound) { note = "notFound() — 대상 없음 처리"; }
        else { mark = "FAIL"; note = `${e.constructor.name}: ${e.message}`; fail++; }
      }
      console.log(`${mark} ${label.padEnd(18)} ${note}`);
    }
  }
  console.log(`\n실패 ${fail}건`);
  process.exit(fail ? 1 : 0);
})();
