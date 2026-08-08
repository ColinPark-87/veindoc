/** 의존성 없는 미니 라인차트 — 대시보드 일별 유입용 */
export default function Sparkline({ data, height = 120 }: { data: number[]; height?: number }) {
  if (!data.length) return <p className="adm-empty">데이터 없음</p>;

  const W = 100; // viewBox 기준(퍼센트처럼 동작)
  const max = Math.max(...data, 1);
  const step = data.length > 1 ? W / (data.length - 1) : W;

  const pts = data.map((v, i) => [i * step, height - (v / max) * (height - 14) - 7] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"} ${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  const area = `${line} L ${W} ${height} L 0 ${height} Z`;

  return (
    <svg className="adm-spark" viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" role="img" aria-label="일별 유입 추이">
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0070BC" stopOpacity=".22" />
          <stop offset="1" stopColor="#0070BC" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sparkFill)" />
      <path d={line} fill="none" stroke="#0070BC" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.6" fill="#0070BC" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}
