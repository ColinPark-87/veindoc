import { createClient } from "@/lib/supabase-server";
import { getMe, isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { promote, setRole } from "./actions";

export const dynamic = "force-dynamic";

const BRANCHES = ["대전", "평촌", "천안"];

const ROLE_LABEL: Record<string, string> = {
  admin: "관리자",
  staff: "직원",
  member: "일반",
};

type Profile = {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  branch: string;
  is_active: boolean;
  created_at: string;
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ r?: string; q?: string }>;
}) {
  const me = await getMe();
  if (!isAdmin(me)) redirect("/admin");

  const sp = await searchParams;
  const role = ["admin", "staff", "member"].includes(sp.r ?? "") ? sp.r! : "";
  const q = (sp.q ?? "").trim();

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id,email,name,role,branch,is_active,created_at")
    .order("created_at", { ascending: false });

  const all = (data ?? []) as Profile[];
  const counts = {
    admin: all.filter((u) => u.role === "admin" && u.is_active).length,
    staff: all.filter((u) => u.role === "staff" && u.is_active).length,
    member: all.filter((u) => u.role === "member").length,
  };

  // 후기 열람용 일반 회원이 같은 표에 쌓이므로 필터 없이는 직원 후보를 못 찾는다
  const rows = all.filter((u) => {
    if (role && u.role !== role) return false;
    if (!q) return true;
    const hay = `${u.email ?? ""} ${u.name ?? ""}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  // 최근 7일 내 가입한 일반 회원 = 권한 부여 후보
  const weekAgo = Date.now() - 7 * 864e5;
  const pending = all.filter(
    (u) => u.role === "member" && new Date(u.created_at).getTime() > weekAgo
  );

  const link = (o: Record<string, string>) =>
    `/admin/members?${new URLSearchParams({ r: role, q, ...o })}`;

  return (
    <>
      <header className="adm-head">
        <div>
          <span className="adm-eyebrow">총괄 관리자</span>
          <h1>계정 관리</h1>
        </div>
        <form className="adm-search" action="/admin/members">
          <input type="hidden" name="r" value={role} />
          <input name="q" defaultValue={q} placeholder="이메일 또는 이름" aria-label="계정 검색" />
          <button type="submit">검색</button>
        </form>
      </header>

      <section className="adm-kpi">
        <Kpi label="관리자" value={String(counts.admin)} sub="전체 권한" />
        <Kpi label="직원" value={String(counts.staff)} sub="예약·환자·문자" />
        <Kpi label="일반 회원" value={String(counts.member)} sub="후기 열람만" />
      </section>

      <div className="adm-note">
        <b>권한 두 단계.</b> <b>직원</b>은 진료 캘린더·환자 관리·예약·문자·게시판·후기까지.
        <b> 관리자</b>는 거기에 더해 대시보드 통계·직원 실적·계정 관리·진료시간 설정과
        공휴일 새로고침까지 볼 수 있습니다.
        <br />
        신규 계정은 사이트에서 회원가입하면 <b>일반</b>으로 만들어집니다. 아래에서 직원 또는
        관리자로 올려야 관리자 페이지에 들어올 수 있습니다.
      </div>

      {pending.length > 0 && (
        <section className="adm-card">
          <div className="adm-card-head">
            <h2>권한 대기</h2>
            <span className="adm-sub">최근 7일 가입 · 일반 권한</span>
          </div>
          <ul className="mb-pending">
            {pending.map((u) => (
              <li key={u.id}>
                <div>
                  <b>{u.name || u.email}</b>
                  <span className="adm-sub">
                    {u.email} · {new Date(u.created_at).toLocaleDateString("ko-KR")} 가입
                  </span>
                </div>
                <form action={promote}>
                  <input type="hidden" name="id" value={u.id} />
                  <input type="hidden" name="role" value="staff" />
                  <button type="submit">직원으로</button>
                </form>
                <form action={promote}>
                  <input type="hidden" name="id" value={u.id} />
                  <input type="hidden" name="role" value="admin" />
                  <button type="submit" className="strong">관리자로</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav className="adm-filter">
        <a href={link({ r: "" })} className={!role ? "on" : ""}>전체 {all.length}</a>
        <a href={link({ r: "admin" })} className={role === "admin" ? "on" : ""}>관리자</a>
        <a href={link({ r: "staff" })} className={role === "staff" ? "on" : ""}>직원</a>
        <a href={link({ r: "member" })} className={role === "member" ? "on" : ""}>일반</a>
      </nav>

      <section className="adm-card">
        <table className="adm-table">
          <thead>
            <tr>
              <th>이메일</th><th>이름</th><th>가입</th><th>현재</th><th>권한 / 지점 / 활성</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td>
                  {u.email}
                  {u.id === me!.id && <span className="adm-tag on">나</span>}
                </td>
                <td>{u.name || "—"}</td>
                <td className="nowrap">{new Date(u.created_at).toLocaleDateString("ko-KR")}</td>
                <td>
                  <span className={`adm-tag ${u.role === "admin" ? "on" : ""}`}>
                    {ROLE_LABEL[u.role] ?? u.role}
                  </span>
                  {!u.is_active && <span className="adm-tag off">비활성</span>}
                </td>
                <td>
                  <form action={setRole} className="adm-row-form">
                    <input type="hidden" name="id" value={u.id} />
                    <select name="role" defaultValue={u.role} disabled={u.id === me!.id}>
                      <option value="member">일반</option>
                      <option value="staff">직원</option>
                      <option value="admin">관리자</option>
                    </select>
                    <select name="branch" defaultValue={u.branch}>
                      {BRANCHES.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                    <label className="adm-check">
                      <input
                        type="checkbox"
                        name="active"
                        defaultChecked={u.is_active}
                        disabled={u.id === me!.id}
                      />
                      <span>활성</span>
                    </label>
                    <button type="submit">적용</button>
                  </form>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <p className="adm-empty">
                    {q || role ? "조건에 맞는 계정이 없습니다." : "계정이 없습니다."}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <p className="adm-sub">
        본인 계정의 권한과 활성은 스스로 바꿀 수 없습니다. 활성 관리자가 한 명뿐일 때는
        그 계정을 내릴 수 없습니다(아무도 못 들어오는 잠금 방지).
      </p>
    </>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="adm-kpi-item">
      <span>{label}</span>
      <b>{value}</b>
      {sub && <i>{sub}</i>}
    </div>
  );
}
