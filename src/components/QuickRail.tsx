"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BRANCHES } from "@/lib/evidence";
import { clinicStatus, type ClinicStatus } from "@/lib/clinic-status";

/**
 * 우측 퀵메뉴 — 원본 사이트 기능 그대로.
 * 온라인예약 / 진료상담 / 리얼스토리 / 치료가상체험 / 약도 문자받기 / 지점 전화
 */
const MENU = [
  { href: "/guide", label: "온라인예약", icon: "reserve" },
  { href: "/guide", label: "진료상담", icon: "counsel" },
  { href: "/reviews", label: "리얼스토리", icon: "story" },
  { href: "/treatment", label: "치료가상체험", icon: "sim" },
] as const;

export default function QuickRail() {
  const [open, setOpen] = useState(false);
  const [branch, setBranch] = useState<string>("");
  const [p2, setP2] = useState("");
  const [p3, setP3] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  // 서버/클라이언트 시각 불일치(hydration) 방지 — 마운트 후 계산
  const [status, setStatus] = useState<ClinicStatus | null>(null);

  useEffect(() => {
    const paint = () => setStatus(clinicStatus());
    paint();
    const t = setInterval(paint, 60000);
    return () => clearInterval(t);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!branch) return setSent("지점을 선택해 주세요.");
    if (p2.length < 3 || p3.length < 4) return setSent("전화번호를 확인해 주세요.");
    // TODO: 실제 SMS 발송 연동 (Supabase inquiries + 문자 API)
    setSent(`${branch} 약도를 010-${p2}-${p3} 로 전송 예약했습니다.`);
  };

  return (
    <>
      <button
        className="qr-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "퀵메뉴 닫기" : "퀵메뉴 열기"}
        aria-expanded={open}
      >
        {open ? "×" : "＋"}
      </button>

      <aside className={`qrail${open ? " open" : ""}`} aria-label="빠른 메뉴">
        {/* 진료 상태 · 시간 (히어로 하단바에서 이동) */}
        <div className="qr-status">
          <span className={`status tone-${status?.tone ?? "pause"}`}>
            <span className="dot" />
            <span className="msg">{status?.msg ?? "진료 상태 확인중"}</span>
          </span>
          <ul className="qr-hours">
            <li><span>평일</span><b>09:00–18:00</b></li>
            <li><span>토</span><b>09:00–13:00</b></li>
            <li><span>점심</span><b>13:00–14:00</b></li>
          </ul>
        </div>

        <ul className="qr-menu">
          {MENU.map((m) => (
            <li key={m.label}>
              <Link href={m.href} data-track="quick" data-track-label={m.label}>
                <QIcon name={m.icon} />
                <span>{m.label}</span>
              </Link>
            </li>
          ))}
        </ul>

        <form className="qr-sms" onSubmit={submit}>
          <b>
            <QIcon name="pin" /> 약도 문자받기
          </b>
          <p>전화번호를 입력하시면 SMS로 약도를 전송해 드립니다.</p>
          <select value={branch} onChange={(e) => setBranch(e.target.value)} aria-label="지점 선택">
            <option value="">지점 선택</option>
            {BRANCHES.map((b) => (
              <option key={b.key} value={b.key}>
                {b.key} 삼성흉부외과
              </option>
            ))}
          </select>
          <div className="qr-phone">
            <span>010</span>
            <input
              inputMode="numeric"
              maxLength={4}
              value={p2}
              onChange={(e) => setP2(e.target.value.replace(/\D/g, ""))}
              aria-label="전화번호 가운데 자리"
            />
            <input
              inputMode="numeric"
              maxLength={4}
              value={p3}
              onChange={(e) => setP3(e.target.value.replace(/\D/g, ""))}
              aria-label="전화번호 끝자리"
            />
          </div>
          <button type="submit" data-track="sms">문자 전송하기</button>
          {sent && <em className="qr-msg">{sent}</em>}
        </form>

        <ul className="qr-tels">
          {BRANCHES.map((b) => (
            <li key={b.key}>
              <a href={`tel:${b.tel.replace(/-/g, "")}`} data-track="tel" data-track-label={b.key}>
                <span>{b.key} 삼성흉부외과</span>
                <b>{b.tel}</b>
              </a>
            </li>
          ))}
        </ul>
      </aside>
    </>
  );
}

function QIcon({ name }: { name: string }) {
  const c = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "reserve":
      return (
        <svg viewBox="0 0 24 24" {...c}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M3 10h18M9 15h6" />
        </svg>
      );
    case "counsel":
      return (
        <svg viewBox="0 0 24 24" {...c}>
          <path d="M8 3h9a2 2 0 0 1 2 2v14l-4-3H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
          <path d="M10 8h6M10 12h4" />
        </svg>
      );
    case "story":
      return (
        <svg viewBox="0 0 24 24" {...c}>
          <path d="M4 6a2 2 0 0 1 2-2h6v14H6a2 2 0 0 0-2 2V6Z" />
          <path d="M20 6a2 2 0 0 0-2-2h-6v14h6a2 2 0 0 1 2 2V6Z" />
        </svg>
      );
    case "sim":
      return (
        <svg viewBox="0 0 24 24" {...c}>
          <circle cx="9" cy="8" r="3" />
          <circle cx="17" cy="10" r="2.4" />
          <path d="M3 20c0-3 2.7-5 6-5s6 2 6 5M14.5 20c.3-2 1.6-3.4 3.5-3.4S21.2 18 21.5 20" />
        </svg>
      );
    case "pin":
      return (
        <svg viewBox="0 0 24 24" {...c}>
          <path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" />
          <circle cx="12" cy="10" r="2.6" />
        </svg>
      );
    default:
      return null;
  }
}
