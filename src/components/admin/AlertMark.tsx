/** 주의 표식 — 사이트 규칙상 이모지를 쓰지 않으므로 SVG 로 그린다.
 *  (색 이모지는 기기·폰트마다 모양이 달라 병원 화면에서 톤이 깨진다) */
export default function AlertMark() {
  return (
    <svg className="adm-alert-mark" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3.6 21 19.2H3L12 3.6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M12 9.6v4.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="16.4" r="1" fill="currentColor" />
    </svg>
  );
}
