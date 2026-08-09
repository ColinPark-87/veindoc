import { cookies } from "next/headers";

/** 직원에게 보여줄 한 줄 안내.
 *
 *  서버 액션에서 throw 하면 Next 의 에러 화면으로 넘어가고, 프로덕션에서는 메시지까지
 *  가려진다("An error occurred..."). 직원 입장에서는 왜 저장이 안 됐는지 알 수가 없다.
 *  그래서 실패를 던지지 않고 쿠키에 담아, 되돌아온 화면 위에 그대로 띄운다.
 *  수명을 짧게 둬서 다음 화면까지 따라다니지 않게 한다. */

const KEY = "adm_notice";

export type Notice = { kind: "err" | "ok"; text: string };

export async function setNotice(kind: Notice["kind"], text: string) {
  const jar = await cookies();
  jar.set(KEY, JSON.stringify({ kind, text }), {
    maxAge: 15,
    httpOnly: true,
    sameSite: "lax",
    path: "/admin",
  });
}

export async function readNotice(): Promise<Notice | null> {
  const jar = await cookies();
  const raw = jar.get(KEY)?.value;
  if (!raw) return null;
  try {
    const n = JSON.parse(raw) as Notice;
    return n.text ? n : null;
  } catch {
    return null;
  }
}

/** 서버 액션 본문을 감싼다. 실패하면 화면에 안내만 남기고 정상 복귀한다. */
export async function guard(run: () => Promise<void>, okText?: string) {
  try {
    await run();
    if (okText) await setNotice("ok", okText);
  } catch (e) {
    // redirect()/notFound() 는 예외로 흐름을 제어하므로 통과시켜야 한다
    const digest = (e as { digest?: string })?.digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_")) throw e;
    await setNotice("err", e instanceof Error ? e.message : "처리하지 못했습니다.");
  }
}
