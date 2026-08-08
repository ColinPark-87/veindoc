"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EVIDENCE } from "@/lib/evidence";

const N_SAMPLES = 64; // 바 윗면 샘플 수

/* hex → rgb 보간 (방울 색 morph) */
function mix(a: string, b: string, t: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const A = p(a);
  const B = p(b);
  return (
    "#" +
    A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("")
  );
}

export default function Hero() {
  const [cur, setCur] = useState(0);
  const [viewerIdx, setViewerIdx] = useState(-1);
  const [swapping, setSwapping] = useState(false);

  const barRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const beadRef = useRef<SVGCircleElement>(null);
  const beadHiRef = useRef<SVGCircleElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  /* 애니메이션 상태는 ref로 (리렌더 유발 금지) */
  const anim = useRef({
    W: 0, H: 96, barTop: 40, barH: 56, R: 24,
    cx: 0, targetCx: 0, amp: 1,
    colFrom: EVIDENCE[0].c, colTo: EVIDENCE[0].c, colT: 1,
    dragging: false, raf: 0 as number, cur: 0,
  });
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const srcRect = useRef<DOMRect | null>(null);

  const slotX = useCallback((i: number) => {
    const a = anim.current;
    return (a.W * (i + 0.5)) / EVIDENCE.length;
  }, []);

  /* 바의 윗면 = 액체 표면. 방울 자리에서 부풀어 오른다 */
  const draw = useCallback(() => {
    const a = anim.current;
    const path = pathRef.current, bead = beadRef.current, hi = beadHiRef.current;
    if (!path || !bead || !hi || !a.W) return;

    const topY = (x: number) => {
      const s = a.R * 2.0;
      const dd = (x - a.cx) / s;
      return a.barTop - Math.exp(-dd * dd * 1.15) * (a.R * 1.02) * a.amp;
    };

    const r = Math.min(20, a.barH / 2);
    let p = `M ${r} ${topY(r)}`;
    for (let i = 1; i <= N_SAMPLES; i++) {
      const x = r + ((a.W - 2 * r) * i) / N_SAMPLES;
      p += ` L ${x.toFixed(1)} ${topY(x).toFixed(1)}`;
    }
    p += ` Q ${a.W} ${topY(a.W - r)} ${a.W} ${a.barTop + r}`;
    p += ` L ${a.W} ${a.H - r} Q ${a.W} ${a.H} ${a.W - r} ${a.H}`;
    p += ` L ${r} ${a.H} Q 0 ${a.H} 0 ${a.H - r}`;
    p += ` L 0 ${a.barTop + r} Q 0 ${topY(r)} ${r} ${topY(r)} Z`;
    path.setAttribute("d", p);

    const by = topY(a.cx) + a.R * 0.34;
    bead.setAttribute("cx", String(a.cx));
    bead.setAttribute("cy", String(by));
    hi.setAttribute("cx", String(a.cx));
    hi.setAttribute("cy", String(by));

    const col = mix(a.colFrom, a.colTo, a.colT);
    bead.setAttribute("fill", col);
    if (glowRef.current) {
      glowRef.current.style.background = `radial-gradient(closest-side, ${col}88, transparent 72%)`;
      glowRef.current.style.transform = `translateX(${a.cx - a.W / 2}px)`;
    }
    document.documentElement.style.setProperty("--accent", col);
  }, []);

  const loop = useCallback(() => {
    const a = anim.current;
    const dx = a.targetCx - a.cx;
    a.cx += dx * 0.16;
    const speed = Math.abs(dx);
    const targetAmp = a.dragging ? 0.72 : speed > 2 ? 0.28 : 1;
    a.amp += (targetAmp - a.amp) * 0.14;
    a.colT = Math.min(1, a.colT + 0.05);
    draw();
    if (Math.abs(dx) > 0.4 || Math.abs(targetAmp - a.amp) > 0.01 || a.colT < 1) {
      a.raf = requestAnimationFrame(loop);
    } else {
      a.raf = 0;
      a.cx = a.targetCx;
      a.amp = targetAmp;
      draw();
    }
  }, [draw]);

  const kick = useCallback(() => {
    const a = anim.current;
    if (!a.raf) a.raf = requestAnimationFrame(loop);
  }, [loop]);

  const resize = useCallback(() => {
    const a = anim.current;
    const bar = barRef.current, svg = svgRef.current;
    if (!bar || !svg) return;
    a.W = bar.clientWidth;
    a.H = bar.clientHeight;
    a.barH = Math.min(56, a.H * 0.58);
    a.barTop = a.H - a.barH;
    a.R = Math.max(18, Math.min(26, (a.W / EVIDENCE.length) * 0.28));
    beadRef.current?.setAttribute("r", String(a.R));
    beadHiRef.current?.setAttribute("r", String(a.R));
    svg.setAttribute("viewBox", `0 0 ${a.W} ${a.H}`);
    a.cx = slotX(a.cur);
    a.targetCx = a.cx;
    draw();
  }, [draw, slotX]);

  const stopAuto = useCallback(() => {
    if (autoRef.current) {
      clearInterval(autoRef.current);
      autoRef.current = null;
    }
  }, []);

  /* 선택 변경 — 색/방울/문구 동시 전환 */
  const select = useCallback(
    (i: number) => {
      const a = anim.current;
      if (i === a.cur) return;
      a.colFrom = mix(a.colFrom, a.colTo, a.colT);
      a.colTo = EVIDENCE[i].c;
      a.colT = 0;
      a.cur = i;
      setSwapping(true);
      setTimeout(() => {
        setCur(i);
        setSwapping(false);
      }, 300);
      kick();
    },
    [kick]
  );

  const goto = useCallback(
    (i: number, user?: boolean) => {
      if (user) stopAuto();
      anim.current.targetCx = slotX(i);
      select(i);
      kick();
    },
    [kick, select, slotX, stopAuto]
  );

  /* 초기화 */
  useEffect(() => {
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [resize]);

  /* 자동 순환 */
  useEffect(() => {
    autoRef.current = setInterval(() => {
      goto((anim.current.cur + 1) % EVIDENCE.length);
    }, 7000);
    return () => stopAuto();
  }, [goto, stopAuto]);

  /* 드래그 */
  useEffect(() => {
    const a = anim.current;
    const nearest = (x: number) => {
      let best = 0, bd = Infinity;
      EVIDENCE.forEach((_, i) => {
        const d = Math.abs(slotX(i) - x);
        if (d < bd) { bd = d; best = i; }
      });
      return best;
    };
    const xFrom = (e: MouseEvent | TouchEvent) => {
      const bar = barRef.current;
      if (!bar) return 0;
      const r = bar.getBoundingClientRect();
      const px = ("touches" in e ? e.touches[0].clientX : e.clientX) - r.left;
      return Math.max(a.R, Math.min(a.W - a.R, px));
    };
    const move = (e: MouseEvent | TouchEvent) => {
      if (!a.dragging) return;
      e.preventDefault();
      const x = xFrom(e);
      a.targetCx = x;
      a.cx = x;
      const n = nearest(x);
      if (n !== a.cur) select(n);
      kick();
    };
    const up = () => {
      if (!a.dragging) return;
      a.dragging = false;
      hitRef.current?.classList.remove("drag");
      a.targetCx = slotX(nearest(a.cx));
      kick();
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
    };
  }, [kick, select, slotX]);

  const hitRef = useRef<HTMLDivElement>(null);
  const onDown = (e: React.MouseEvent | React.TouchEvent) => {
    stopAuto();
    anim.current.dragging = true;
    hitRef.current?.classList.add("drag");
    const bar = barRef.current;
    if (!bar) return;
    const r = bar.getBoundingClientRect();
    const px = ("touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX) - r.left;
    const a = anim.current;
    const x = Math.max(a.R, Math.min(a.W - a.R, px));
    a.cx = x; a.targetCx = x;
    let best = 0, bd = Infinity;
    EVIDENCE.forEach((_, i) => {
      const d = Math.abs(slotX(i) - x);
      if (d < bd) { bd = d; best = i; }
    });
    select(best);
    kick();
  };

  /* FLIP 뷰어 */
  const fullBox = () => {
    const p = Math.min(window.innerWidth, window.innerHeight) * 0.035;
    return { top: p, left: p, width: window.innerWidth - p * 2, height: window.innerHeight - p * 2 };
  };
  const place = (r: { top: number; left: number; width: number; height: number }, rad: string) => {
    const v = viewerRef.current;
    if (!v) return;
    Object.assign(v.style, {
      top: `${r.top}px`, left: `${r.left}px`,
      width: `${r.width}px`, height: `${r.height}px`, borderRadius: rad,
    });
  };
  const openViewer = () => {
    const f = frameRef.current, v = viewerRef.current;
    if (!f || !v) return;
    srcRect.current = f.getBoundingClientRect();
    setViewerIdx(anim.current.cur);
    v.classList.remove("anim");
    place(srcRect.current, "14px");
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        v.classList.add("anim");
        place(fullBox(), "14px");
      })
    );
  };
  const closeViewer = () => {
    const v = viewerRef.current;
    if (!v || viewerIdx < 0) return;
    v.classList.add("anim");
    if (srcRect.current) place(srcRect.current, "14px");
    setViewerIdx(-1);
  };
  useEffect(() => {
    if (viewerIdx >= 0) document.body.classList.add("lock");
    else document.body.classList.remove("lock");
  }, [viewerIdx]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeViewer();
      if (viewerIdx >= 0) {
        if (e.key === "ArrowLeft") setViewerIdx((i) => (i - 1 + EVIDENCE.length) % EVIDENCE.length);
        if (e.key === "ArrowRight") setViewerIdx((i) => (i + 1) % EVIDENCE.length);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const ev = EVIDENCE[cur];
  const vIdx = viewerIdx >= 0 ? viewerIdx : 0;

  return (
    <>
      <section className="hero" id="hero">
        <div className="shell">
          <div className="hcopy">
            <span className={`eyebrow fadeswap${swapping ? " out" : ""}`}>{ev.eb}</span>
            <h1
              className={`htitle fadeswap${swapping ? " out" : ""}`}
              dangerouslySetInnerHTML={{ __html: ev.t }}
            />
            <p className={`hdesc fadeswap${swapping ? " out" : ""}`}>{ev.d}</p>
          </div>

          {/* 아버지 원본 5장 — 무보정, 원본 비율 */}
          <div className="evband">
            <div
              className="evframe"
              ref={frameRef}
              onClick={openViewer}
              data-track="evidence"
              /* 모바일 프레임 높이 = 현재 슬라이드 파생본의 비율. 잘림·왜곡 0 */
              style={{ "--evr": String(EVIDENCE[cur].mr) } as React.CSSProperties}
            >
              {EVIDENCE.map((e, i) => (
                <picture key={e.img}>
                  <source media="(max-width:900px)" srcSet={e.imgMobile} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={e.img}
                    alt={e.tab}
                    loading={i === 0 ? "eager" : "lazy"}
                    className={i === cur ? "on" : undefined}
                  />
                </picture>
              ))}
              <span className="zoom">크게 보기 ↗</span>
            </div>
          </div>

          {/* 메니스커스 바 */}
          <div className="mnzone">
            <div className="mnhead">
              <b>
                20년의 증거 <em>{EVIDENCE.length}</em>
              </b>
              <span>방울을 탭하거나 바를 따라 끌어보세요</span>
            </div>
            <div className="mnbar" ref={barRef}>
              <div className="mnglow" ref={glowRef} />
              <svg ref={svgRef} preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <linearGradient id="beadGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#fff" stopOpacity=".38" />
                    <stop offset="1" stopColor="#fff" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path ref={pathRef} fill="#141b22" />
                <circle ref={beadRef} r="24" fill={EVIDENCE[0].c} />
                <circle ref={beadHiRef} r="24" fill="url(#beadGrad)" />
              </svg>
              <div
                className="mnhit"
                ref={hitRef}
                onMouseDown={onDown}
                onTouchStart={onDown}
              >
                {EVIDENCE.map((e, i) => (
                  <button
                    key={e.tab}
                    className={i === cur ? "on" : undefined}
                    onClick={() => goto(i, true)}
                  >
                    {e.tab}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 진료 상태·시간은 우측 퀵메뉴 상단으로 이동(QuickRail).
              전화번호도 퀵메뉴에 3지점이 있어 중복이라 제거함. */}
        </div>
      </section>

      {/* FLIP 뷰어 */}
      <div
        className={`viewer${viewerIdx >= 0 ? " live" : ""}`}
        ref={viewerRef}
        role="dialog"
        aria-modal="true"
      >
        <div className="vtop">
          <span>
            {String(vIdx + 1).padStart(2, "0")} / {String(EVIDENCE.length).padStart(2, "0")}
          </span>
          <button className="vclose" onClick={closeViewer}>닫기 ×</button>
        </div>
        <div className="vbody">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={EVIDENCE[vIdx].img} alt={EVIDENCE[vIdx].tab} />
        </div>
        <div className="vfoot">
          <div>
            <b dangerouslySetInnerHTML={{ __html: EVIDENCE[vIdx].t.replace(/<br>/g, " ") }} />
            <span>{EVIDENCE[vIdx].d}</span>
          </div>
          <div className="vnav">
            <button onClick={() => setViewerIdx((i) => (i - 1 + EVIDENCE.length) % EVIDENCE.length)}>←</button>
            <button onClick={() => setViewerIdx((i) => (i + 1) % EVIDENCE.length)}>→</button>
          </div>
        </div>
      </div>

      <div
        className={`scrim${viewerIdx >= 0 ? " live" : ""}`}
        onClick={closeViewer}
      />

    </>
  );
}
