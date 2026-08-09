import { createClient } from "@/lib/supabase-server";
import AlertMark from "@/components/admin/AlertMark";
import { queueSms } from "./actions";

export const dynamic = "force-dynamic";

const BRANCH_MAP: Record<string, string> = {
  대전: "대전광역시 서구 둔산동 1109 DS클리닉 2층 / 042-471-3075",
  평촌: "경기도 안양시 동안구 범계동 1045-1 이랜드프라자 4층 / 031-382-7588",
  천안: "충남 천안시 신부동 462-7 문타워 4층 / 041-564-8877",
};

export default async function Page() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sms_logs")
    .select("id,to_phone,body,template,branch,status,error,created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <>
      <header className="adm-head">
        <div>
          <span className="adm-eyebrow">직원</span>
          <h1>문자 발송</h1>
        </div>
      </header>

      <div className="adm-grid2">
        <section className="adm-card">
          <h2>새 문자</h2>
          <form action={queueSms} className="adm-form">
            <label>
              <span>받는 번호</span>
              <input name="phone" required placeholder="010-1234-5678" inputMode="tel" />
            </label>
            <label>
              <span>지점</span>
              <select name="branch" defaultValue="대전">
                {Object.keys(BRANCH_MAP).map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </label>
            <label>
              <span>템플릿</span>
              <select name="template" defaultValue="약도">
                <option value="약도">약도 안내</option>
                <option value="예약확인">예약 확인</option>
                <option value="안내">일반 안내</option>
              </select>
            </label>
            <label>
              <span>내용</span>
              <textarea
                name="body"
                rows={5}
                required
                defaultValue={`[삼성흉부외과 대전]\n${BRANCH_MAP["대전"]}\n오시는 길 안내드립니다.`}
              />
            </label>
            <button type="submit">발송 대기열에 넣기</button>
            <p className="adm-note">
              <AlertMark /> 실제 발송 API는 아직 미연동입니다. 지금은 <b>대기열(queued)</b>로만 기록됩니다.
              문자 사업자(알리고·NHN 등) 계정을 연결하면 실제 발송됩니다.
            </p>
          </form>
        </section>

        <section className="adm-card">
          <h2>발송 이력</h2>
          <table className="adm-table">
            <thead>
              <tr>
                <th>시각</th>
                <th>번호</th>
                <th>구분</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((r) => (
                <tr key={r.id}>
                  <td className="nowrap">{new Date(r.created_at).toLocaleString("ko-KR")}</td>
                  <td className="nowrap">{r.to_phone}</td>
                  <td>{r.template ?? "—"}</td>
                  <td>
                    <span className={`adm-status ${r.status === "sent" ? "done" : r.status === "failed" ? "cancelled" : "new"}`}>
                      {r.status === "sent" ? "발송" : r.status === "failed" ? "실패" : "대기"}
                    </span>
                  </td>
                </tr>
              ))}
              {(data ?? []).length === 0 && (
                <tr>
                  <td colSpan={4}><p className="adm-empty">발송 이력이 없습니다.</p></td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
