/**
 * 크롤한 942건 치료후기 → Supabase 이관.
 *
 *   PowerShell:
 *     $env:SUPABASE_URL="https://grjptglaektlcoyhkdup.supabase.co"
 *     $env:SUPABASE_SERVICE_KEY="<secret key — 절대 이 파일에 적지 말 것>"
 *     node scripts/import_reviews.mjs
 *
 * 원본: D:/Colin 작업폴더/삼성흉부외과 사이트/site/nvein/0604_view.html__idx=*
 * 마크업: <li class="b_col8"> 번호/제목/·/작성자/조회  →  <li class="col1"> 본문
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const MIRROR = "D:/Colin 작업폴더/삼성흉부외과 사이트/site/nvein";
const SUPA_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
const DRY = process.argv.includes("--dry");

if (!DRY && (!SUPA_URL || !KEY)) {
  console.error("SUPABASE_URL / SUPABASE_SERVICE_KEY 필요. (미리보기: --dry)");
  process.exit(1);
}

const strip = (h) =>
  h
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const files = (await readdir(MIRROR)).filter((f) => f.startsWith("0604_view.html__idx="));
console.log(`대상 파일 ${files.length}건`);

const rows = [];
const skipped = [];

for (const f of files) {
  const idx = Number(f.match(/idx=(\d+)/)?.[1]);
  if (!idx) continue;
  const html = new TextDecoder("euc-kr").decode(await readFile(path.join(MIRROR, f)));

  // 메타 행: <li class="b_col8"> … <span class="td">번호</span><p class="td">제목</p>
  //          <span class="td"></span><span class="td">작성자</span><span class="td">조회</span>
  const metaLi = html.match(/<li class="b_col8">([\s\S]*?)<\/li>/i)?.[1] ?? "";
  const metaNoComment = metaLi.replace(/<!--[\s\S]*?-->/g, "");
  const title = strip(metaNoComment.match(/<p class="td">([\s\S]*?)<\/p>/i)?.[1] ?? "");
  const tds = [...metaNoComment.matchAll(/<span class="td">([\s\S]*?)<\/span>/gi)].map((m) =>
    strip(m[1])
  );
  const views = Number((tds[tds.length - 1] || "0").replace(/[^0-9]/g, "")) || 0;
  const author = tds[tds.length - 2] || "";

  // 본문: <li class="col1"> … </li>
  const bodyLi = html.match(/<li class="col1">([\s\S]*?)<\/li>/i)?.[1] ?? "";
  const body = strip(bodyLi);

  if (!title && !body) {
    skipped.push(idx);
    continue;
  }

  rows.push({
    id: idx,
    title: (title || `치료후기 ${idx}`).slice(0, 300),
    body,
    views,
    is_secret: false,
    branch: "대전",
  });
}

const empty = rows.filter((r) => !r.body).length;
console.log(
  `파싱 완료 ${rows.length}건 (본문 없음 ${empty} · 스킵 ${skipped.length})`
);
console.log("샘플:", JSON.stringify(rows[0], null, 1).slice(0, 420));

if (DRY) {
  console.log("\n--dry 모드. 업로드하지 않고 종료합니다.");
  process.exit(0);
}

const headers = {
  apikey: KEY,
  "Content-Type": "application/json",
  Prefer: "resolution=merge-duplicates,return=minimal",
};
// 레거시 service_role(JWT)만 Bearer 필요. 새 sb_secret_ 키는 apikey 헤더만.
if (KEY.startsWith("eyJ")) headers.Authorization = `Bearer ${KEY}`;

for (let i = 0; i < rows.length; i += 300) {
  const chunk = rows.slice(i, i + 300);
  const res = await fetch(`${SUPA_URL}/rest/v1/reviews?on_conflict=id`, {
    method: "POST",
    headers,
    body: JSON.stringify(chunk),
  });
  if (!res.ok) {
    console.error(`업로드 실패 @${i}: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  console.log(`  ${Math.min(i + 300, rows.length)} / ${rows.length}`);
}

console.log("완료.");
