/**
 * 치료법 이미지 수집 — 상업적 사용 가능한 소스만.
 *   Openverse (CC0/CC-BY, API 키 불필요)
 * 후보를 내려받아 후보목록을 출력한다. 선택 후 normalize_images.mjs 로 통일 처리.
 *
 *   node scripts/find_images.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT = "D:/Colin 작업폴더/veindoc-mvp/_img_candidates";

/** 슬라이드별 검색어 — 시술을 직접 보여주되 과장/환부 노출 없는 것 */
const QUERIES = [
  { key: "laser", q: "medical laser device hospital" },
  { key: "rf", q: "catheter medical procedure hospital" },
  { key: "surgery", q: "surgical instruments sterile tray" },
  { key: "sclero", q: "syringe injection medical clinic" },
  { key: "reop", q: "doctor ultrasound examination leg" },
  { key: "insurance", q: "medical documents clipboard hospital desk" },
];

async function search(q) {
  const url =
    "https://api.openverse.org/v1/images/?" +
    new URLSearchParams({
      q,
      license_type: "commercial,modification", // 상업적 사용 + 변형 허용
      size: "large",
      page_size: "8",
      mature: "false",
    });
  const res = await fetch(url, { headers: { "User-Agent": "veindoc-mvp/1.0" } });
  if (!res.ok) throw new Error(`openverse ${res.status}`);
  return (await res.json()).results ?? [];
}

await mkdir(OUT, { recursive: true });
const manifest = [];

for (const { key, q } of QUERIES) {
  process.stdout.write(`\n[${key}] "${q}"\n`);
  let results = [];
  try {
    results = await search(q);
  } catch (e) {
    console.log("  검색 실패:", e.message);
    continue;
  }
  let i = 0;
  for (const r of results) {
    if (!r.url) continue;
    i++;
    if (i > 4) break;
    const file = `${key}_${i}.jpg`;
    try {
      const img = await fetch(r.url, { headers: { "User-Agent": "veindoc-mvp/1.0" } });
      if (!img.ok) throw new Error(String(img.status));
      const buf = Buffer.from(await img.arrayBuffer());
      if (buf.length < 20000) throw new Error("too small");
      await writeFile(path.join(OUT, file), buf);
      manifest.push({
        key, file,
        title: r.title ?? "",
        license: `${r.license ?? ""} ${r.license_version ?? ""}`.trim(),
        creator: r.creator ?? "",
        source: r.foreign_landing_url ?? r.url,
        bytes: buf.length,
      });
      console.log(`  ✓ ${file}  ${(buf.length / 1024) | 0}KB  [${r.license}] ${(r.title ?? "").slice(0, 40)}`);
    } catch (e) {
      console.log(`  ✗ ${file} (${e.message})`);
      i--;
    }
  }
}

await writeFile(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 1), "utf8");
console.log(`\n총 ${manifest.length}건 → ${OUT}`);
console.log("라이선스 정보는 manifest.json 에 기록됨 (출처 표기용).");
