"use server";

import { createClient } from "@/lib/supabase-server";

/** 사이트 퀵메뉴의 '약도 문자받기' 접수.
 *  익명 insert 만 허용된 inquiries 로 들어가고, 직원이 /admin/inquiries 에서 처리한다.
 *  (여기서 문자를 바로 쏘지 않는다 — 익명이 문자 발송을 유발할 수 있으면 스팸 통로가 된다) */
export async function requestMapSms(input: {
  branch: string;
  phone: string;
}): Promise<{ ok: boolean; message: string }> {
  const branch = String(input.branch ?? "").trim();
  const phone = String(input.phone ?? "").replace(/[^0-9]/g, "");

  if (!branch) return { ok: false, message: "지점을 선택해 주세요." };
  if (phone.length < 10) return { ok: false, message: "전화번호를 확인해 주세요." };

  const supabase = await createClient();
  const { error } = await supabase.from("inquiries").insert({
    name: "약도 요청",
    phone,
    message: `${branch} 약도 문자 요청`,
    branch,
    kind: "map_sms",
  });

  if (error) return { ok: false, message: "접수에 실패했습니다. 잠시 후 다시 시도해 주세요." };
  return { ok: true, message: `${branch} 약도를 곧 문자로 보내드리겠습니다.` };
}
