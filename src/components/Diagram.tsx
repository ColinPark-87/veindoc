/** 설명용 도해 — 래스터 대신 SVG 로 그린다.
 *
 *  이 사이트는 아이콘·표식을 SVG 로 통일한다(래스터 생성물은 화질·톤이 흔들린다).
 *  도해도 같은 이유로 SVG 다. 선화라 확대해도 깨지지 않고, 용량이 작고,
 *  브랜드 색을 그대로 쓴다.
 *
 *  중요: 여기 있는 것은 '구조를 설명하는 그림'이다. 환자 사진·초음파 소견·시술 장면처럼
 *  이 병원의 실제 임상 기록으로 읽힐 수 있는 이미지는 만들지 않는다. */

const BLUE = "#0070BC";
const GREEN = "#04A33F";
const INK = "#1b242d";
const RED = "#C8102E";   // 역류 = 문제 신호(사이트에서 공휴일·경고에 쓰는 색)

export type DiagramKey = "valve" | "symptoms" | "steps" | "network";

export default function Diagram({ name }: { name: DiagramKey }) {
  if (name === "valve") return <ValveDiagram />;
  if (name === "symptoms") return <SymptomDiagram />;
  if (name === "steps") return <StepsDiagram />;
  if (name === "network") return <NetworkDiagram />;
  return null;
}

/** 진료 절차 4단계 — 옆 목록과 같은 내용을 흐름으로 보여준다 */
function StepsDiagram() {
  const steps = ["접수 · 문진", "도플러 초음파", "진료 상담", "시술 · 경과"];
  return (
    <svg
      className="dgm"
      viewBox="0 0 260 440"
      role="img"
      aria-label="접수와 문진, 도플러 초음파, 진료 상담, 시술과 경과 관찰의 네 단계로 진행된다"
    >
      <path d="M46 44 V396" stroke={BLUE} strokeWidth="2" opacity=".28" fill="none" />
      {steps.map((label, i) => {
        const y = 52 + i * 112;
        const last = i === steps.length - 1;
        return (
          <g key={label}>
            <circle cx="46" cy={y} r="17" fill={last ? GREEN : BLUE} />
            <text
              x="46"
              y={y + 5}
              textAnchor="middle"
              fill="#fff"
              fontSize="15"
              fontWeight="700"
            >
              {i + 1}
            </text>
            <text x="78" y={y + 5} fill={INK} fontSize="15" fontWeight="600">
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** 세 지점 — 실제 남북 순서(안양·평촌 → 천안 → 대전)를 지킨다 */
function NetworkDiagram() {
  const sites = [
    { name: "안양 · 평촌", tel: "031-382-7588" },
    { name: "천안", tel: "041-564-8877" },
    { name: "대전", tel: "042-471-3075" },
  ];
  return (
    <svg
      className="dgm"
      viewBox="0 0 300 440"
      role="img"
      aria-label="안양 평촌, 천안, 대전 세 곳에서 진료한다"
    >
      <path d="M54 60 V380" stroke={BLUE} strokeWidth="2" opacity=".28" fill="none" />
      {sites.map((s, i) => {
        const y = 76 + i * 144;
        const main = s.name === "대전";
        return (
          <g key={s.name}>
            <circle cx="54" cy={y} r={main ? 12 : 8} fill={main ? GREEN : BLUE} />
            {main && <circle cx="54" cy={y} r="21" fill={GREEN} opacity=".16" />}
            <text x="86" y={y - 2} fill={INK} fontSize="16" fontWeight="700">
              {s.name}
            </text>
            <text x="86" y={y + 20} fill={INK} fontSize="13" opacity=".6">
              {s.tel}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** 증상이 나타나는 부위 — 다리 윤곽에 표시점만 찍는다.
 *  환부 사진이 아니라 위치 안내용이므로 도해로 충분하다. */
function SymptomDiagram() {
  const spots: [number, number][] = [
    [94, 148], // 허벅지 안쪽
    [104, 224], // 무릎 뒤
    [90, 298], // 종아리
    [102, 380], // 발목
  ];
  return (
    <svg
      className="dgm"
      viewBox="0 0 200 440"
      role="img"
      aria-label="허벅지 안쪽, 무릎 뒤, 종아리, 발목에 증상이 자주 나타난다"
    >
      {/* 다리 윤곽 */}
      <path
        d="M64 20 C 62 108 80 168 82 212 C 84 250 68 268 70 302
           C 72 342 88 372 90 404 V418 H118 V404
           C 120 372 138 342 140 302 C 142 268 126 250 128 212
           C 130 168 148 108 146 20 Z"
        fill={BLUE}
        opacity=".06"
        stroke={BLUE}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* 늘어난 표재정맥 — 구불구불한 선 */}
      <path
        d="M106 52 C 94 92 116 116 100 152 C 88 184 112 206 98 240
           C 88 272 110 296 100 330 C 94 356 100 378 104 398"
        fill="none"
        stroke={BLUE}
        strokeWidth="2.6"
        strokeLinecap="round"
        opacity=".75"
      />
      {/* 증상 지점 */}
      {spots.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r="13" fill={GREEN} opacity=".14" />
          <circle cx={x} cy={y} r="5" fill={GREEN} />
        </g>
      ))}
    </svg>
  );
}

/** 정상 판막과 판막 부전(역류) 비교 */
function ValveDiagram() {
  return (
    <svg
      className="dgm"
      viewBox="0 0 640 400"
      role="img"
      aria-label="정상 판막은 피를 위로만 보내고, 판막이 고장나면 피가 아래로 역류하며 정맥이 늘어난다"
    >
      {/* 정상 */}
      <g transform="translate(150 0)">
        <path
          d="M-34 30 V370"
          stroke={BLUE}
          strokeWidth="2"
          fill="none"
          opacity=".45"
        />
        <path d="M34 30 V370" stroke={BLUE} strokeWidth="2" fill="none" opacity=".45" />
        <rect x="-34" y="30" width="68" height="340" fill={BLUE} opacity=".07" />

        {/* 닫힌 판막 두 쌍 — 잎이 맞닿아 아래로 못 내려간다 */}
        {[140, 250].map((y) => (
          <g key={y}>
            <path
              d={`M-34 ${y - 34} Q -6 ${y} 0 ${y + 4} Q 6 ${y} 34 ${y - 34}`}
              fill="none"
              stroke={BLUE}
              strokeWidth="3"
              strokeLinecap="round"
            />
          </g>
        ))}

        {/* 위로 흐르는 피 */}
        {[330, 210, 100].map((y) => (
          <g key={y} stroke={GREEN} strokeWidth="3" strokeLinecap="round" fill="none">
            <path d={`M0 ${y} V${y - 42}`} />
            <path d={`M-9 ${y - 33} L0 ${y - 44} L9 ${y - 33}`} />
          </g>
        ))}
      </g>

      {/* 판막 부전 */}
      <g transform="translate(470 0)">
        {/* 판막 아래가 늘어난 정맥 */}
        <path
          d="M-30 30 V150 C -30 190 -62 210 -62 260 C -62 320 -34 340 -30 370"
          stroke={BLUE}
          strokeWidth="2"
          fill="none"
          opacity=".45"
        />
        <path
          d="M30 30 V150 C 30 190 62 210 62 260 C 62 320 34 340 30 370"
          stroke={BLUE}
          strokeWidth="2"
          fill="none"
          opacity=".45"
        />
        <path
          d="M-30 30 V150 C -30 190 -62 210 -62 260 C -62 320 -34 340 -30 370
             H30 C 34 340 62 320 62 260 C 62 210 30 190 30 150 V30 Z"
          fill={BLUE}
          opacity=".07"
        />

        {/* 열린 채 맞닿지 못하는 판막 잎 */}
        <path
          d="M-30 116 Q -20 150 -14 168"
          fill="none"
          stroke={RED}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M30 116 Q 20 150 14 168"
          fill="none"
          stroke={RED}
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* 아래로 새는 피 */}
        <g stroke={RED} strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M0 150 V250" />
          <path d="M-9 241 L0 252 L9 241" />
        </g>
        <g stroke={GREEN} strokeWidth="3" strokeLinecap="round" fill="none" opacity=".55">
          <path d="M0 350 V312" />
          <path d="M-9 321 L0 310 L9 321" />
        </g>
      </g>
    </svg>
  );
}
