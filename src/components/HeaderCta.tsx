"use client";

import { OPEN_SELFCHECK } from "./SelfCheck";

/** 헤더 우측 CTA 2종 — 자가체크(퍼플) / 네이버 톡톡(그린) */
export default function HeaderCta() {
  return (
    <div className="hcta-group">
      <button
        className="btn-ck"
        data-track="selfcheck"
        aria-label="내 증상 자가체크"
        onClick={() => window.dispatchEvent(new CustomEvent(OPEN_SELFCHECK))}
      >
        <span className="ck-ring" aria-hidden="true" />
        <svg className="ck-ico" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4.5" y="3" width="15" height="18" rx="2.6" fill="currentColor" />
          <g className="ck-marks" stroke="#6D31C4" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path d="M7.8 8.3l1.3 1.3 2.3-2.5" />
            <path d="M7.8 13.1l1.3 1.3 2.3-2.5" />
            <path d="M7.8 17.9l1.3 1.3 2.3-2.5" />
          </g>
          <g stroke="#6D31C4" strokeWidth="1.7" strokeLinecap="round" opacity=".4">
            <path d="M13.6 8.5h2.9" />
            <path d="M13.6 13.3h2.9" />
          </g>
        </svg>
        <span className="cta-label">내 증상 자가체크</span>
      </button>

      <a className="btn-tt" href="#" data-track="talktalk" aria-label="네이버 톡톡 문의">
        <span className="tt-ring" aria-hidden="true" />
        <svg className="tt-bubble" viewBox="0 0 26 24" aria-hidden="true">
          <path
            d="M13 3.4c-5 0-9 3.2-9 7.2 0 2.5 1.6 4.8 4.1 6.1l-.9 3.5c-.1.5.4.8.8.6l4-2.4c.3 0 .7.05 1 .05 5 0 9-3.2 9-7.2S18 3.4 13 3.4Z"
            fill="currentColor"
          />
          <g className="tt-dots" fill="#03C75A">
            <circle cx="9" cy="10.6" r="1.5" />
            <circle cx="13" cy="10.6" r="1.5" />
            <circle cx="17" cy="10.6" r="1.5" />
          </g>
        </svg>
        <span className="cta-label">네이버 톡톡문의</span>
      </a>
    </div>
  );
}
