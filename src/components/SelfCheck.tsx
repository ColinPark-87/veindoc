"use client";

import { useEffect, useState } from "react";
import { SYMPTOMS } from "@/lib/evidence";

/** 헤더 버튼이 쏘는 이벤트 이름 */
export const OPEN_SELFCHECK = "open-selfcheck";

/**
 * 증상 자가체크 — 전 페이지 공용.
 * TODO: 결과 제출을 구글 설문지로 연동 예정.
 */
export default function SelfCheck() {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<boolean[]>(() => SYMPTOMS.map(() => false));

  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener(OPEN_SELFCHECK, on);
    return () => window.removeEventListener(OPEN_SELFCHECK, on);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("lock", open);
  }, [open]);

  const n = checked.filter(Boolean).length;
  const verdict =
    n === 0
      ? "항목을 선택해 주세요."
      : n <= 1
      ? "경과 관찰을 권합니다."
      : n <= 3
      ? "초음파 검사를 권합니다."
      : "정밀 진단이 필요합니다.";

  return (
    <>
      <div className={`scrim${open ? " live" : ""}`} onClick={() => setOpen(false)} />
      <div className={`checker${open ? " live" : ""}`} role="dialog" aria-modal="true">
        <div className="ck-top">
          <h3>내 증상 자가체크</h3>
          <button className="ck-close" onClick={() => setOpen(false)} aria-label="닫기">
            ×
          </button>
        </div>
        <div className="ck-body">
          <p>해당하는 항목을 모두 선택하세요. 겉으로 혈관이 보이지 않아도 하지정맥류일 수 있습니다.</p>
          <div className="ck-list">
            {SYMPTOMS.map((s, i) => (
              <label key={s}>
                <input
                  type="checkbox"
                  checked={checked[i]}
                  onChange={() => setChecked((c) => c.map((v, k) => (k === i ? !v : v)))}
                />
                <span>{s}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="ck-foot">
          <span className="ck-result">
            {n > 0 && <b>{n}개 해당 — </b>}
            {verdict}
          </span>
          {/* TODO: 구글 설문지 URL 연결 */}
          <button className="ck-go">상담 문의하기</button>
        </div>
      </div>
    </>
  );
}
