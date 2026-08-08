"use client";

import { useActionState } from "react";
import { signInAdmin, type LoginState } from "../actions";

const EMPTY: LoginState = {};

export default function LoginForm({ denied }: { denied?: boolean }) {
  const [state, formAction, pending] = useActionState(signInAdmin, EMPTY);

  return (
    <div className="adm-login">
      <form action={formAction} className="adm-login-box">
        <svg className="adm-login-mark" viewBox="0 0 100 100" aria-hidden="true">
          <rect x="3" y="32" width="28" height="28" fill="#04A33F" />
          <path d="M36 2 h28 v20 a14 14 0 0 1 -14 14 h-14 z" fill="#0070BC" />
          <rect x="36" y="30" width="28" height="68" fill="#0070BC" />
          <path d="M50 98 V52 a12 12 0 0 1 12 -12 h36" fill="none" stroke="#04A33F" strokeWidth="7" />
          <path d="M62 98 V60 a10 10 0 0 1 10 -10 h26" fill="none" stroke="#04A33F" strokeWidth="7" />
          <path d="M74 98 V70 a8 8 0 0 1 8 -8 h16" fill="none" stroke="#04A33F" strokeWidth="7" />
        </svg>
        <h1>관리자 로그인</h1>
        <p>총괄 관리자 · 직원 공용 · 권한에 따라 화면이 달라집니다.</p>

        <label>
          <span>아이디 (이메일)</span>
          <input type="email" name="email" required autoComplete="username" placeholder="name@veindoc.co.kr" />
        </label>
        <label>
          <span>비밀번호</span>
          <input type="password" name="password" required autoComplete="current-password" />
        </label>

        {denied && <p className="adm-msg err">관리자 권한이 없는 계정입니다.</p>}
        {state.error && <p className="adm-msg err">{state.error}</p>}

        <button type="submit" disabled={pending}>
          {pending ? "확인 중…" : "로그인"}
        </button>

        <span className="adm-login-foot">권한 문의는 총괄 관리자에게 요청하세요.</span>
      </form>
    </div>
  );
}
