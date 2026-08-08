"use client";

import { useState } from "react";
import type { Review } from "@/lib/reviews";

const PER_PAGE = 6;

export default function ReviewDeck({
  reviews,
  total,
  source,
  signOutAction,
  email,
}: {
  reviews: Review[];
  total: number;
  source: "supabase" | "sample";
  signOutAction?: () => Promise<void>;
  email?: string;
}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  const filtered = q
    ? reviews.filter((r) => (r.title + r.body).toLowerCase().includes(q.toLowerCase()))
    : reviews;
  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const p = Math.min(page, pages - 1);
  const shown = filtered.slice(p * PER_PAGE, p * PER_PAGE + PER_PAGE);

  return (
    <section className="deck" style={{ ["--accent" as string]: "#7A3FD1" }}>
      <div className="shell deck-in">
        <div className="deck-top">
          <span className="deck-title">
            치료후기 <em style={{ fontStyle: "normal", color: "var(--ink40)" }}>{total}</em>
          </span>
          <span className="deck-count">
            {String(p + 1).padStart(2, "0")} <i>/</i> {String(pages).padStart(2, "0")}
          </span>
        </div>

        <div className="rv-tools">
          <input
            className="rv-search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder="증상이나 시술로 검색 — 예: 쥐, 반바지, 레이저"
            aria-label="후기 검색"
          />
          {source === "sample" && (
            <span className="rv-note">Supabase 연결 전 — 샘플 표시중</span>
          )}
          {signOutAction && (
            <form action={signOutAction} className="rv-me">
              <span>{email}</span>
              <button type="submit">로그아웃</button>
            </form>
          )}
        </div>

        <div className="rv-grid">
          {shown.map((r) => (
            <article key={r.id}>
              <h3>{r.title}</h3>
              <p>{r.body}</p>
              <span className="rv-meta">조회 {r.views.toLocaleString("ko-KR")}</span>
            </article>
          ))}
          {shown.length === 0 && <div className="rv-empty">검색 결과가 없습니다.</div>}
        </div>

        <div className="deck-nav">
          <div className="deck-dots">
            {Array.from({ length: pages }).map((_, k) => (
              <button key={k} className={k === p ? "on" : undefined} onClick={() => setPage(k)}>
                <em>{k + 1}</em>
              </button>
            ))}
          </div>
          <div className="deck-arrows">
            <button onClick={() => setPage(p - 1)} disabled={p === 0} aria-label="이전">←</button>
            <button onClick={() => setPage(p + 1)} disabled={p >= pages - 1} aria-label="다음">→</button>
          </div>
        </div>
      </div>
    </section>
  );
}
