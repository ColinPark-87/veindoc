import { createClient } from "@/lib/supabase-server";
import { getMe, isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { setRole } from "./actions";

export const dynamic = "force-dynamic";

export default async function Page() {
  const me = await getMe();
  if (!isAdmin(me)) redirect("/admin");

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id,email,name,role,branch,is_active,created_at")
    .order("created_at", { ascending: false });

  return (
    <>
      <header className="adm-head">
        <div>
          <span className="adm-eyebrow">총괄 관리자</span>
          <h1>계정 관리</h1>
        </div>
      </header>

      <p className="adm-note">
        신규 계정은 사이트에서 회원가입하면 <b>member</b> 로 생성됩니다.
        여기서 <b>staff</b> 또는 <b>admin</b> 으로 올려야 관리자 페이지에 들어올 수 있습니다.
      </p>

      <section className="adm-card">
        <table className="adm-table">
          <thead>
            <tr><th>이메일</th><th>이름</th><th>지점</th><th>권한 / 활성</th><th></th></tr>
          </thead>
          <tbody>
            {(data ?? []).map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.name || "—"}</td>
                <td>{u.branch}</td>
                <td>
                  <span className={`adm-tag ${u.role === "admin" ? "on" : ""}`}>
                    {u.role === "admin" ? "관리자" : u.role === "staff" ? "직원" : "일반"}
                  </span>
                  {!u.is_active && <span className="adm-tag off">비활성</span>}
                </td>
                <td>
                  <form action={setRole} className="adm-row-form">
                    <input type="hidden" name="id" value={u.id} />
                    <select name="role" defaultValue={u.role}>
                      <option value="member">일반</option>
                      <option value="staff">직원</option>
                      <option value="admin">관리자</option>
                    </select>
                    <label className="adm-check">
                      <input type="checkbox" name="active" defaultChecked={u.is_active} />
                      <span>활성</span>
                    </label>
                    <button type="submit">적용</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
