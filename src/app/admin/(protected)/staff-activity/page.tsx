import { createClient } from "@/lib/supabase-server";
import { getMe, isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, string> = {
  "auth.login": "로그인",
  "auth.logout": "로그아웃",
  "appointment.update": "예약 처리",
  "sms.queue": "문자 발송",
  "post.create": "글 작성",
  "post.publish": "글 공개",
  "post.unpublish": "글 숨김",
  "post.delete": "글 삭제",
  "review.hide": "후기 숨김",
  "review.show": "후기 공개",
  "review.delete": "후기 삭제",
  "profile.role": "권한 변경",
  "settings.update": "진료시간 변경",
};

export default async function Page() {
  const me = await getMe();
  if (!isAdmin(me)) redirect("/admin");

  const supabase = await createClient();
  const [summary, recent] = await Promise.all([
    supabase.from("v_staff_activity").select("*"),
    supabase
      .from("activity_logs")
      .select("id,actor,action,entity,entity_id,created_at,profiles(name,email)")
      .order("created_at", { ascending: false })
      .limit(120),
  ]);

  return (
    <>
      <header className="adm-head">
        <div>
          <span className="adm-eyebrow">총괄 관리자</span>
          <h1>직원 실적</h1>
        </div>
      </header>

      <section className="adm-card">
        <h2>직원별 처리 건수</h2>
        <table className="adm-table">
          <thead>
            <tr><th>이름</th><th>권한</th><th>총 처리</th><th>최근 7일</th><th>마지막 활동</th></tr>
          </thead>
          <tbody>
            {(summary.data ?? []).map((s: Record<string, unknown>) => (
              <tr key={String(s.id)}>
                <td>{(s.name as string) || (s.email as string)}</td>
                <td><span className={`adm-tag ${s.role === "admin" ? "on" : ""}`}>{s.role === "admin" ? "관리자" : "직원"}</span></td>
                <td>{Number(s.actions ?? 0).toLocaleString("ko-KR")}</td>
                <td>{Number(s.actions_7d ?? 0).toLocaleString("ko-KR")}</td>
                <td>{s.last_at ? new Date(String(s.last_at)).toLocaleString("ko-KR") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="adm-card">
        <h2>최근 활동 로그</h2>
        <table className="adm-table">
          <thead><tr><th>시각</th><th>담당</th><th>작업</th><th>대상</th></tr></thead>
          <tbody>
            {(recent.data ?? []).map((r: Record<string, unknown>) => {
              const p = r.profiles as { name?: string; email?: string } | null;
              return (
                <tr key={String(r.id)}>
                  <td className="nowrap">{new Date(String(r.created_at)).toLocaleString("ko-KR")}</td>
                  <td>{p?.name || p?.email || "—"}</td>
                  <td>{ACTION_LABEL[String(r.action)] ?? String(r.action)}</td>
                  <td className="adm-sub">{r.entity ? `${r.entity} ${r.entity_id ?? ""}` : "—"}</td>
                </tr>
              );
            })}
            {(recent.data ?? []).length === 0 && (
              <tr><td colSpan={4}><p className="adm-empty">아직 기록된 활동이 없습니다.</p></td></tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
