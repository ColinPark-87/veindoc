import { CLINIC } from "@/lib/evidence";

/** 신호등 색 — open:초록 / pause:노랑(일시중지) / closed:빨강(휴진·종료) */
export type StatusTone = "open" | "pause" | "closed";
export type ClinicStatus = { open: boolean; tone: StatusTone; msg: string };

/**
 * 오늘 진료 여부 — 히어로/퀵메뉴 공용.
 * TODO: clinic_settings 테이블 값으로 교체(현재 CLINIC.hours 는 가정값).
 */
export function clinicStatus(now = new Date()): ClinicStatus {
  const d = now.getDay();
  const h = now.getHours() + now.getMinutes() / 60;
  const { open, weekdayEnd, satEnd, lunch } = CLINIC.hours;

  // 좁은 퀵메뉴(132px)에 한 줄로 들어가야 해서 문구를 짧게 유지한다
  const hhmm = (n: number) => `${String(n).padStart(2, "0")}:00`;

  // 일요일 = 휴진 (빨강)
  if (d === 0) return { open: false, tone: "closed", msg: "일요일 휴진" };

  const close = d === 6 ? satEnd : weekdayEnd;

  // 진료 시작 전 = 곧 열림 (노랑)
  if (h < open) return { open: false, tone: "pause", msg: `${hhmm(open)} 진료 시작` };

  // 진료 종료 = 오늘은 끝 (빨강)
  if (h >= close) return { open: false, tone: "closed", msg: "오늘 진료 종료" };

  // 점심시간 = 잠시 중단 (노랑)
  if (d !== 6 && h >= lunch[0] && h < lunch[1])
    return { open: false, tone: "pause", msg: `점심 · ${hhmm(lunch[1])} 재개` };

  return { open: true, tone: "open", msg: `진료중 · ${hhmm(close)}까지` };
}
