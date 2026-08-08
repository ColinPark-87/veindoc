/** 의존성 없는 통계 차트 — 꺾은선/막대 공용.
 *  툴팁은 <title> 로 처리해 클라이언트 JS 없이 서버 컴포넌트로 쓴다. */

export type Point = { label: string; value: number; sub?: string };

type Props = {
  data: Point[];
  kind?: "line" | "bar";
  height?: number;
  color?: string;
  unit?: string;
  /** x축 라벨을 몇 개 건너뛰고 그릴지. 기본은 개수에 맞춰 자동 */
  tickEvery?: number;
};

const PAD = { l: 38, r: 10, t: 10, b: 22 };

export default function Chart({
  data,
  kind = "line",
  height = 220,
  color = "#0070BC",
  unit = "",
  tickEvery,
}: Props) {
  if (!data.length) return <p className="adm-empty">데이터 없음</p>;

  const W = 720;
  const H = height;
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;

  const max = niceMax(Math.max(...data.map((d) => d.value), 1));
  const y = (v: number) => PAD.t + ih - (v / max) * ih;

  // 막대는 칸 가운데, 꺾은선은 점 위치. 한 칸 폭을 공유해 축이 어긋나지 않게 한다
  const slot = iw / data.length;
  const cx = (i: number) => PAD.l + slot * (i + 0.5);

  const every = tickEvery ?? Math.max(1, Math.ceil(data.length / 8));
  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));

  const pts = data.map((d, i) => [cx(i), y(d.value)] as const);
  const line = pts.map(([x, yy], i) => `${i ? "L" : "M"} ${x.toFixed(1)} ${yy.toFixed(1)}`).join(" ");
  const area = `${line} L ${pts[pts.length - 1][0].toFixed(1)} ${PAD.t + ih} L ${pts[0][0].toFixed(1)} ${PAD.t + ih} Z`;

  const gid = `chartFill-${color.replace("#", "")}`;

  return (
    <svg className="adm-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="통계 차트">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".22" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {grid.map((g) => (
        <g key={g}>
          <line className="ch-grid" x1={PAD.l} x2={W - PAD.r} y1={y(g)} y2={y(g)} />
          <text className="ch-ytick" x={PAD.l - 6} y={y(g) + 3.5} textAnchor="end">
            {g.toLocaleString("ko-KR")}
          </text>
        </g>
      ))}

      {kind === "bar" ? (
        data.map((d, i) => {
          const bw = Math.max(3, Math.min(28, slot * 0.62));
          const h = Math.max(d.value > 0 ? 2 : 0, PAD.t + ih - y(d.value));
          return (
            <rect
              key={d.label + i}
              className="ch-bar"
              x={cx(i) - bw / 2}
              y={PAD.t + ih - h}
              width={bw}
              height={h}
              fill={color}
              rx="2"
            >
              <title>{`${d.label} · ${d.value.toLocaleString("ko-KR")}${unit}${d.sub ? ` (${d.sub})` : ""}`}</title>
            </rect>
          );
        })
      ) : (
        <>
          <path d={area} fill={`url(#${gid})`} />
          <path
            d={line}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {pts.map(([x, yy], i) => (
            <circle key={i} cx={x} cy={yy} r="3" fill="#fff" stroke={color} strokeWidth="2">
              <title>{`${data[i].label} · ${data[i].value.toLocaleString("ko-KR")}${unit}${
                data[i].sub ? ` (${data[i].sub})` : ""
              }`}</title>
            </circle>
          ))}
        </>
      )}

      {data.map((d, i) =>
        i % every === 0 || i === data.length - 1 ? (
          <text key={d.label + i} className="ch-xtick" x={cx(i)} y={H - 6} textAnchor="middle">
            {d.label}
          </text>
        ) : null
      )}
    </svg>
  );
}

/** 축 최대값을 1/2/5 배수로 올림 — 눈금 숫자가 지저분해지지 않게 */
function niceMax(v: number) {
  const mag = 10 ** Math.floor(Math.log10(v));
  const n = v / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * mag;
}
