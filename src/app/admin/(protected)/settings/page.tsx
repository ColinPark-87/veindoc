import { createClient } from "@/lib/supabase-server";
import { getMe, isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { saveHours } from "./actions";

export const dynamic = "force-dynamic";

type Hours = { open?: string; close?: string; start?: string; end?: string };

export default async function Page() {
  const me = await getMe();
  if (!isAdmin(me)) redirect("/admin");

  const supabase = await createClient();
  const { data } = await supabase.from("clinic_settings").select("*").order("branch");

  return (
    <>
      <header className="adm-head">
        <div>
          <span className="adm-eyebrow">총괄 관리자</span>
          <h1>진료시간 설정</h1>
        </div>
      </header>

      <p className="adm-note">
        ⚠️ 현재 사이트의 진료시간은 <b>가정값</b>입니다. 원본 홈페이지에 진료시간이 텍스트로 없어
        확인이 안 됐습니다. 실제 시간으로 저장하면 홈 하단의 “오늘 진료중” 판정도 정확해집니다.
      </p>

      <div className="adm-grid2">
        {(data ?? []).map((c) => {
          const w = (c.weekday ?? {}) as Hours;
          const s = (c.saturday ?? {}) as Hours;
          const l = (c.lunch ?? {}) as Hours;
          return (
            <section className="adm-card" key={c.branch}>
              <h2>{c.branch}</h2>
              <form action={saveHours} className="adm-form">
                <input type="hidden" name="branch" value={c.branch} />
                <div className="adm-time">
                  <label><span>평일 시작</span><input type="time" name="w_open" defaultValue={w.open ?? "09:00"} /></label>
                  <label><span>평일 종료</span><input type="time" name="w_close" defaultValue={w.close ?? "18:00"} /></label>
                </div>
                <div className="adm-time">
                  <label><span>토요일 시작</span><input type="time" name="s_open" defaultValue={s.open ?? "09:00"} /></label>
                  <label><span>토요일 종료</span><input type="time" name="s_close" defaultValue={s.close ?? "13:00"} /></label>
                </div>
                <div className="adm-time">
                  <label><span>점심 시작</span><input type="time" name="l_start" defaultValue={l.start ?? "13:00"} /></label>
                  <label><span>점심 종료</span><input type="time" name="l_end" defaultValue={l.end ?? "14:00"} /></label>
                </div>
                <label>
                  <span>안내 문구 (휴진 공지 등)</span>
                  <input name="notice" defaultValue={c.notice ?? ""} placeholder="예: 8/15 광복절 휴진" />
                </label>
                <button type="submit">저장</button>
              </form>
            </section>
          );
        })}
      </div>
    </>
  );
}
