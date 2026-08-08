import Link from "next/link";
import { createVisit, saveVisitNote, sendPatientSms, toggleArrival } from "../care-actions";

export type Visit = {
  id: string;
  name: string;
  phone: string;
  patient_id: string | null;
  preferred_at: string | null;
  status: string;
  arrived_at: string | null;
  doctor: string | null;
  day_note: string | null;
  next_at: string | null;
  memo: string | null;
  branch: string | null;
};

const hhmm = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : "—";

/** datetime-local 은 로컬 시간 문자열만 받는다(ISO 그대로 넣으면 비어 보인다) */
const localInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function DayPanel({
  date,
  holiday,
  visits,
}: {
  date: string;
  holiday: string | null;
  visits: Visit[];
}) {
  const pending = visits.filter((v) => !v.arrived_at);
  const label = new Date(`${date}T00:00:00`).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  return (
    <section className="adm-card cal-panel">
      <div className="adm-card-head">
        <h2>
          {label}
          {holiday && <span className="cal-badge hol">{holiday}</span>}
        </h2>
        <span className="adm-sub">
          예약 {visits.length}건 · 미내원 {pending.length}건
        </span>
      </div>

      {/* 당일 알림 — 아직 안 온 사람만 위로 올려 눈에 띄게 한다 */}
      {pending.length > 0 && (
        <div className="cal-alert">
          <b>당일 알림</b>
          <ul>
            {pending.map((v) => (
              <li key={v.id}>
                <span>{hhmm(v.preferred_at)}</span>
                <em>{v.name}</em>
                <a href={`tel:${v.phone}`}>{v.phone}</a>
                {v.doctor && <i>{v.doctor}</i>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {visits.length === 0 ? (
        <p className="adm-empty">이 날 예약이 없습니다.</p>
      ) : (
        <ul className="cal-visits">
          {visits.map((v) => (
            <li key={v.id} className={v.arrived_at ? "in" : ""}>
              <div className="cv-top">
                <span className="cv-time">{hhmm(v.preferred_at)}</span>
                <b className="cv-name">
                  {v.patient_id ? (
                    <Link href={`/admin/patients/${v.patient_id}`}>{v.name}</Link>
                  ) : (
                    v.name
                  )}
                </b>
                <a className="cv-tel" href={`tel:${v.phone}`}>{v.phone}</a>

                <form action={toggleArrival} className="cv-check">
                  <input type="hidden" name="id" value={v.id} />
                  <input type="hidden" name="arrived" value={v.arrived_at ? "0" : "1"} />
                  <button type="submit" className={v.arrived_at ? "on" : ""}>
                    {v.arrived_at ? `내원 ${hhmm(v.arrived_at)}` : "내원 체크"}
                  </button>
                </form>
              </div>

              <form action={saveVisitNote} className="cv-form">
                <input type="hidden" name="id" value={v.id} />
                <input type="hidden" name="patient_id" value={v.patient_id ?? ""} />
                <label>
                  <span>주치의</span>
                  <input name="doctor" defaultValue={v.doctor ?? ""} placeholder="진료 본 선생님" />
                </label>
                <label className="grow">
                  <span>당일 특이 기록</span>
                  <input name="day_note" defaultValue={v.day_note ?? ""} placeholder="처치·경과·주의사항" />
                </label>
                <label>
                  <span>다음 진료</span>
                  <input type="datetime-local" name="next_at" defaultValue={localInput(v.next_at)} />
                </label>
                <button type="submit">저장</button>
              </form>

              <form action={sendPatientSms} className="cv-sms">
                <input type="hidden" name="phone" value={v.phone} />
                <input type="hidden" name="branch" value={v.branch ?? "대전"} />
                <input type="hidden" name="template" value="진료안내" />
                <input
                  name="body"
                  placeholder="문자 내용 — 예: 오늘 예약 안내드립니다"
                  defaultValue={`${v.name}님, ${hhmm(v.preferred_at)} 진료 예약 안내드립니다. 삼성흉부외과 대전`}
                />
                <button type="submit">문자 보내기</button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <details className="cal-add">
        <summary>이 날짜에 예약 추가</summary>
        <form action={createVisit} className="cv-form">
          <input type="hidden" name="branch" value="대전" />
          <label>
            <span>이름</span>
            <input name="name" required placeholder="환자 이름" />
          </label>
          <label>
            <span>전화번호</span>
            <input name="phone" required placeholder="01012345678" inputMode="numeric" />
          </label>
          <label>
            <span>일시</span>
            <input type="datetime-local" name="preferred_at" defaultValue={`${date}T09:30`} />
          </label>
          <label>
            <span>주치의</span>
            <input name="doctor" placeholder="담당 선생님" />
          </label>
          <label className="grow">
            <span>메모</span>
            <input name="memo" placeholder="접수 메모" />
          </label>
          <button type="submit">등록</button>
        </form>
        <p className="adm-sub">
          같은 이름·전화번호면 기존 환자에 이어서 쌓입니다. 이름이 같아도 전화번호가 다르면 다른 사람으로 봅니다.
        </p>
      </details>
    </section>
  );
}
