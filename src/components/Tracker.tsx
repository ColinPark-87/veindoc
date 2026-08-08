"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * 유입/클릭 수집 — 총괄 대시보드용.
 * 개인정보는 수집하지 않는다(세션 난수 + 경로 + 기기 구분만).
 */
const SID_KEY = "vd_sid";

function sessionId() {
  try {
    let v = sessionStorage.getItem(SID_KEY);
    if (!v) {
      v = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(SID_KEY, v);
    }
    return v;
  } catch {
    return "";
  }
}

function post(table: "page_views" | "click_events", body: Record<string, unknown>) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return;
  const headers: Record<string, string> = {
    apikey: key,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;
  // 실패해도 사용자 경험에 영향 주지 않게 조용히 무시
  fetch(`${url}/rest/v1/${table}`, { method: "POST", headers, body: JSON.stringify(body), keepalive: true }).catch(
    () => {}
  );
}

export default function Tracker() {
  const pathname = usePathname();

  useEffect(() => {
    const device = window.matchMedia("(max-width:900px)").matches ? "mobile" : "desktop";
    post("page_views", {
      path: pathname,
      referrer: document.referrer || null,
      device,
      session_id: sessionId(),
    });
  }, [pathname]);

  useEffect(() => {
    const device = window.matchMedia("(max-width:900px)").matches ? "mobile" : "desktop";
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-track]");
      if (!el) return;
      post("click_events", {
        target: el.dataset.track,
        label: el.dataset.trackLabel ?? el.textContent?.trim().slice(0, 60) ?? null,
        path: pathname,
        device,
        session_id: sessionId(),
      });
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [pathname]);

  return null;
}
