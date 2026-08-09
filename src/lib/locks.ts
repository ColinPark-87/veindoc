import { createClient } from "@/lib/supabase-server";

export type LockState = {
  /** 남이 잡고 있는가 */
  locked: boolean;
  /** 내가 잡고 있는가(= 지금 수정 가능) */
  mine: boolean;
  holder: string;
  until: string | null;
};

export const FREE: LockState = { locked: false, mine: false, holder: "", until: null };

/** 화면에 그릴 잠금 상태를 한 번에 읽는다(행마다 조회하면 목록에서 N+1 이 된다) */
export async function readLocks(
  entity: string,
  ids: string[],
  meId: string
): Promise<Map<string, LockState>> {
  const map = new Map<string, LockState>();
  if (ids.length === 0) return map;

  const supabase = await createClient();
  const { data } = await supabase
    .from("edit_locks")
    .select("entity_id,actor,actor_name,expires_at")
    .eq("entity", entity)
    .in("entity_id", ids)
    .gt("expires_at", new Date().toISOString());

  for (const r of data ?? []) {
    const mine = r.actor === meId;
    map.set(String(r.entity_id), {
      locked: !mine,
      mine,
      holder: r.actor_name ?? "다른 직원",
      until: r.expires_at,
    });
  }
  return map;
}

/** "2분 남음" — 남은 시간을 초 단위까지 보여줄 필요는 없다 */
export function remainText(until: string | null): string {
  if (!until) return "";
  const ms = new Date(until).getTime() - Date.now();
  if (ms <= 0) return "곧 풀림";
  const m = Math.ceil(ms / 60000);
  return `${m}분 남음`;
}
