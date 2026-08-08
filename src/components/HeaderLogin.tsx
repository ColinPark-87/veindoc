"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  headerSignIn,
  headerSignUp,
  headerSignOut,
  type LoginState,
} from "@/app/actions/session";

const EMPTY: LoginState = {};

/**
 * 헤더 우측 로그인 — 아이디/비밀번호 드롭다운.
 * 로그인 상태면 이름 + (권한 있으면) 관리자 바로가기 + 로그아웃.
 */
export default function HeaderLogin({
  email,
  isStaff,
}: {
  email?: string | null;
  isStaff?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"in" | "up">("in");
  const [state, formAction, pending] = useActionState(
    mode === "in" ? headerSignIn : headerSignUp,
    EMPTY
  );
  const wrap = useRef<HTMLDivElement>(null);

  // 바깥 클릭 / ESC 로 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // 로그인 성공하면 닫기
  useEffect(() => {
    if (email) setOpen(false);
  }, [email]);

  if (email) {
    return (
      <div className="hlogin" ref={wrap}>
        <button
          className="hlogin-btn on"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <UserIcon />
          <span className="cta-label">{email.split("@")[0]}</span>
        </button>

        {open && (
          <div className="hlogin-pop">
            <p className="hlogin-who">{email}</p>
            {isStaff && (
              <a className="hlogin-admin" href="/admin">
                관리자 페이지 →
              </a>
            )}
            <form action={headerSignOut}>
              <button type="submit" className="hlogin-out">로그아웃</button>
            </form>
          </div>
        )}
      </div>
    );
  }

  const openWith = (m: "in" | "up") => {
    setMode(m);
    // 같은 버튼을 다시 누르면 닫기
    setOpen((v) => (mode === m ? !v : true));
  };

  return (
    <div className="hlogin" ref={wrap}>
      <div className="hlogin-btns">
        <button
          className={`hlogin-btn${open && mode === "in" ? " active" : ""}`}
          onClick={() => openWith("in")}
          aria-expanded={open && mode === "in"}
        >
          <UserIcon />
          <span className="cta-label">로그인</span>
        </button>
        <button
          className={`hlogin-btn join${open && mode === "up" ? " active" : ""}`}
          onClick={() => openWith("up")}
          aria-expanded={open && mode === "up"}
        >
          회원가입
        </button>
      </div>

      {open && (
        <div className="hlogin-pop">
          <p className="hlogin-title">{mode === "in" ? "로그인" : "회원가입"}</p>

          <form action={formAction} className="hlogin-form" key={mode}>
            {mode === "up" && (
              <label>
                <span>이름</span>
                <input name="name" autoComplete="name" placeholder="홍길동" />
              </label>
            )}
            <label>
              <span>아이디 (이메일)</span>
              <input
                type="email"
                name="email"
                required
                autoComplete="username"
                placeholder="name@example.com"
                autoFocus
              />
            </label>
            <label>
              <span>비밀번호</span>
              <input
                type="password"
                name="password"
                required
                minLength={mode === "up" ? 6 : undefined}
                autoComplete={mode === "in" ? "current-password" : "new-password"}
                placeholder={mode === "up" ? "6자 이상" : ""}
              />
            </label>

            {state.error && <p className="hlogin-err">{state.error}</p>}
            {state.notice && <p className="hlogin-ok">{state.notice}</p>}

            <button type="submit" className="hlogin-go" disabled={pending}>
              {pending ? "확인 중…" : mode === "in" ? "로그인" : "가입하기"}
            </button>
            <span className="hlogin-note">
              {mode === "in"
                ? "치료후기 열람 · 관리자 진입에 사용됩니다."
                : "가입하면 치료후기 162건을 열람할 수 있습니다."}
            </span>
            <button
              type="button"
              className="hlogin-swap"
              onClick={() => setMode(mode === "in" ? "up" : "in")}
            >
              {mode === "in" ? "계정이 없으신가요? 회원가입" : "이미 계정이 있으신가요? 로그인"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20c.6-4 3.7-6 7.5-6s6.9 2 7.5 6" />
    </svg>
  );
}
