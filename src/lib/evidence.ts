/** 아버지가 보존을 원한 20년의 증거 5장 — 원본 1383×401, 무보정 */
export type Evidence = {
  tab: string;
  img: string;
  /** 모바일용 파생본 — 원본에서 '실사 영역'만 크롭(문구는 t/d 로 이미 화면에 있음).
   *  원본은 무보정 보존, 이쪽만 public/hero/mobile/ 에 따로 둔다. */
  imgMobile: string;
  /** imgMobile 의 가로/세로 비 — 모바일 프레임 높이를 이 값으로 맞춰 잘림·왜곡 둘 다 0 */
  mr: number;
  /** 메니스커스 방울 색 — 5개가 색상환에서 서로 46° 이상 떨어지게 */
  c: string;
  eb: string;
  /** 제목 (줄바꿈 <br>, 숫자 강조 <span class="num">) */
  t: string;
  d: string;
};

export const EVIDENCE: Evidence[] = [
  {
    tab: "성과",
    img: "/hero/slide_img4.jpg",
    imgMobile: "/hero/mobile/slide_img4.jpg",
    mr: 2.02,
    c: "#0070BC", // 블루 204°
    eb: "Why 삼성흉부외과",
    t: '하지정맥류 <span class="num">40,000</span> 케이스',
    d: "삼성의료원 흉부외과 전문의 · 해외논문 게재 및 심사위원 · 전 파장대 레이저 장비",
  },
  {
    tab: "미국 학회",
    img: "/hero/slide_img20191004.jpg",
    imgMobile: "/hero/mobile/slide_img20191004.jpg",
    mr: 2.49,
    c: "#C8102E", // 레드 350°
    eb: "2019 · Global",
    t: "미국 정맥학회 이사<br>캐더린 깁슨 박사 협진",
    d: "세계적인 정맥류 석학이 본원을 찾아 함께 수술했습니다.",
  },
  {
    tab: "일본 학회",
    img: "/hero/slide_img3.jpg",
    imgMobile: "/hero/mobile/slide_img3.jpg",
    mr: 1.69,
    c: "#04A33F", // 그린 142°
    eb: "Academic",
    t: "일본 정맥학회장<br>본원 방문",
    d: "호시노 교수가 삼성흉부외과의 최신 치료를 참관했습니다.",
  },
  {
    tab: "리얼스토리",
    img: "/hero/slide_img1.jpg",
    imgMobile: "/hero/mobile/slide_img1.jpg",
    mr: 1.12,
    c: "#7A3FD1", // 퍼플 264°
    eb: "Real Story",
    t: "다리에 무거움과<br>통증을 느끼신다면",
    d: "환자가 직접 말하는 치료의 기록입니다.",
  },
  {
    tab: "회복",
    img: "/hero/slide_img2.jpg",
    imgMobile: "/hero/mobile/slide_img2.jpg",
    mr: 1.12,
    c: "#F09000", // 오렌지 36°
    eb: "Real Story",
    t: "생활에 지장 없이<br>빠른 회복이 가능합니다",
    d: "수술 다음 날부터 일상으로 돌아갑니다.",
  },
];

/** 증상 자가체크 — 원본 사이트 nvein/0302·0303 본문에서 추출 */
export const SYMPTOMS = [
  "다리가 쉽게 피곤하고 무겁게 느껴진다",
  "종아리가 자주 붓거나 저리고 당긴다",
  "밤에 자다가 다리에 쥐가 난다",
  "발목이 붓고 가렵거나 피부색이 변했다",
  "다리에 혈관이 튀어나와 보인다",
  "오래 서 있으면 다리 통증이 심해진다",
];

/** 대전 본원 — 원본 사이트 nintro/0207 에서 확인한 실제 값 */
export const CLINIC = {
  name: "삼성흉부외과의원",
  branch: "대전",
  ceo: "차대원",
  bizNo: "314-91-03689",
  address: "대전광역시 서구 둔산동 1109 DS클리닉 2층",
  tel: "042-471-3075",
  // TODO: 실제 진료시간 확인 필요 — 원본 사이트에 텍스트로 존재하지 않음(만화 삽화뿐)
  hours: { weekdayEnd: 18, satEnd: 13, open: 9, lunch: [13, 14] as const },
};

/** 하지정맥류 네트워크 3지점 — 원본 사이트 푸터 실제 값 */
export const BRANCHES = [
  {
    key: "대전",
    ceo: "차대원",
    bizNo: "314-91-03689",
    address: "대전광역시 서구 둔산동 1109번지 DS클리닉 2층",
    tel: "042-471-3075",
    fax: "",
  },
  {
    key: "평촌",
    ceo: "김성철",
    bizNo: "138-90-56590",
    address: "경기도 안양시 동안구 범계동 1045-1 이랜드프라자 4층",
    tel: "031-382-7588",
    fax: "031-382-7589",
  },
  {
    key: "천안",
    ceo: "문상호",
    bizNo: "312-91-30725",
    address: "충남 천안시 신부동 462-7번지 문타워 4층",
    tel: "041-564-8877",
    fax: "041-564-8878",
  },
] as const;

/** 푸터 링크 (원본 사이트 하단 메뉴) */
export const FOOT_LINKS = [
  { label: "개인정보취급방침", href: "/privacy" },
  { label: "병원소식", href: "/news" },
  { label: "진료안내", href: "/guide" },
] as const;
