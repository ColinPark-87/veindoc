"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Diagram, { type DiagramKey } from "@/components/Diagram";

export type Slide = {
  /** 좌측 상단 라벨 */
  eb: string;
  /** 제목 (HTML 허용: <br>, <span class="num">) */
  t: string;
  /** 본문 */
  d?: string;
  /** 불릿 목록 */
  list?: string[];
  /** 우측 이미지 (없으면 플레이스홀더) */
  img?: string;
  /** 이미지 자리 안내 문구 — 추후 실제 이미지로 교체 */
  imgNote?: string;
  /** 설명 도해(SVG). 사진이 아니라 구조 설명이 필요한 자리에 쓴다 */
  diagram?: DiagramKey;
  /** 하단 지표 */
  stats?: { k: string; v: string }[];
};

/**
 * PPT 슬라이드형 덱.
 * - 페이지 스크롤 없음. 한 화면 = 한 슬라이드.
 * - 좌우 방향키 / 휠 / 스와이프 / 하단 인디케이터로 이동.
 */
export default function Deck({
  title,
  slides,
  accent = "#0070BC",
}: {
  title: string;
  slides: Slide[];
  accent?: string;
}) {
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const lock = useRef(false);
  const touchX = useRef(0);

  const go = useCallback(
    (n: number) => {
      const next = Math.max(0, Math.min(slides.length - 1, n));
      if (next === i) return;
      setDir(next > i ? 1 : -1);
      setI(next);
    },
    [i, slides.length]
  );

  /* 휠 — 연속 입력 잠금으로 한 칸씩 */
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 12 && Math.abs(e.deltaX) < 12) return;
      const down = e.deltaY > 0 || e.deltaX > 0;
      // 마지막 슬라이드에서 아래로 → 푸터를 볼 수 있게 기본 스크롤 허용
      if (down && i === slides.length - 1) return;
      // 페이지가 아래로 내려가 있으면 위로 스크롤도 허용
      if (!down && window.scrollY > 4) return;
      e.preventDefault();
      if (lock.current) return;
      lock.current = true;
      setTimeout(() => (lock.current = false), 620);
      go(i + (down ? 1 : -1));
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [go, i, slides.length]);

  /* 키보드 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(e.key)) { e.preventDefault(); go(i + 1); }
      if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) { e.preventDefault(); go(i - 1); }
      if (e.key === "Home") go(0);
      if (e.key === "End") go(slides.length - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, i, slides.length]);

  /* 스와이프 */
  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 48) go(i + (dx < 0 ? 1 : -1));
  };

  const s = slides[i];

  return (
    <section
      className="deck has-edge"
      style={{ ["--accent" as string]: accent }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="shell deck-in">
        <div className="deck-top">
          <span className="deck-title">{title}</span>
          <span className="deck-count">
            {String(i + 1).padStart(2, "0")} <i>/</i> {String(slides.length).padStart(2, "0")}
          </span>
        </div>

        <div className="deck-body" key={i} data-dir={dir}>
          <div className="deck-copy">
            <span className="eyebrow">{s.eb}</span>
            <h2 className="htitle" dangerouslySetInnerHTML={{ __html: s.t }} />
            {s.d && <p className="hdesc">{s.d}</p>}
            {s.list && (
              <ul className="deck-list">
                {s.list.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            )}
            {s.stats && (
              <div className="deck-stats">
                {s.stats.map((st) => (
                  <div key={st.k}>
                    <b>{st.v}</b>
                    <span>{st.k}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="deck-media">
            {s.diagram ? (
              <Diagram name={s.diagram} />
            ) : s.img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.img} alt={s.eb} />
            ) : (
              <div className="ph">
                <span>{s.imgNote ?? "이미지 준비중"}</span>
              </div>
            )}
          </div>
        </div>

        <div className="deck-nav">
          <div className="deck-dots">
            {slides.map((sl, k) => (
              <button
                key={sl.eb + k}
                className={k === i ? "on" : undefined}
                onClick={() => go(k)}
                aria-label={`${k + 1}번 슬라이드`}
              >
                <em>{sl.eb}</em>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 좌우 가장자리 화살표 — 슬라이드 넘기듯 */}
      <button className="deck-edge left" onClick={() => go(i - 1)} disabled={i === 0} aria-label="이전 슬라이드">
        ←
      </button>
      <button
        className="deck-edge right"
        onClick={() => go(i + 1)}
        disabled={i === slides.length - 1}
        aria-label="다음 슬라이드"
      >
        →
      </button>
    </section>
  );
}
