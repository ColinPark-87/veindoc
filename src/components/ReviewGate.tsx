"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthState } from "@/app/reviews/actions";

const EMPTY: AuthState = {};

export default function ReviewGate() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const action = mode === "in" ? signIn : signUp;
  const [state, formAction, pending] = useActionState(action, EMPTY);

  return (
    <div className="gate">
      <div className="gate-box">
        <span className="eyebrow">Members Only</span>
        <h2>치료후기는<br />회원만 열람할 수 있습니다</h2>
        <p>
          치료 후기(체험담)는 의료법상 열람 대상이 제한됩니다.
          간단한 가입 후 <b>162건</b>의 실제 후기를 보실 수 있습니다.
        </p>

        <form action={formAction} className="gate-form">
          <label>
            <span>이메일</span>
            <input type="email" name="email" required autoComplete="email" placeholder="name@example.com" />
          </label>
          <label>
            <span>비밀번호</span>
            <input
              type="password"
              name="password"
              required
              minLength={6}
              autoComplete={mode === "in" ? "current-password" : "new-password"}
              placeholder="6자 이상"
            />
          </label>

          {state.error && <p className="gate-msg err">{state.error}</p>}
          {state.notice && <p className="gate-msg ok">{state.notice}</p>}

          <button type="submit" className="gate-go" disabled={pending}>
            {pending ? "처리중…" : mode === "in" ? "로그인하고 후기 보기" : "가입하고 후기 보기"}
          </button>
        </form>

        <button className="gate-swap" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "처음이신가요? 회원가입" : "이미 계정이 있으신가요? 로그인"}
        </button>
      </div>
    </div>
  );
}
