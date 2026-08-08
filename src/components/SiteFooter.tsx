import Link from "next/link";
import { BRANCHES, FOOT_LINKS } from "@/lib/evidence";

/** 원본 사이트 하단 3지점 사업자정보 — 내용 유지, 디자인은 현재 톤 */
export default function SiteFooter() {
  return (
    <footer className="sfoot">
      <div className="shell sfoot-in">
        <nav className="sfoot-links">
          {FOOT_LINKS.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
          <span className="sfoot-blogs">
            <a href="https://blog.naver.com/" target="_blank" rel="noopener noreferrer">
              NAVER 블로그
            </a>
            <a href="https://www.tistory.com/" target="_blank" rel="noopener noreferrer">
              TISTORY 블로그
            </a>
            <a className="sns" href="https://www.facebook.com/" target="_blank" rel="noopener noreferrer" aria-label="페이스북">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5h1.65V3.6c-.3-.04-1.3-.13-2.45-.13-2.4 0-4.05 1.47-4.05 4.17V9.9H7.5V13h2.7v8h3.3Z" />
              </svg>
            </a>
            <a className="sns" href="https://twitter.com/" target="_blank" rel="noopener noreferrer" aria-label="트위터">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 5.9c-.7.3-1.4.5-2.1.6.8-.5 1.3-1.2 1.6-2-.7.4-1.5.7-2.3.9a3.6 3.6 0 0 0-6.2 3.3A10.3 10.3 0 0 1 4.5 4.8a3.6 3.6 0 0 0 1.1 4.8c-.6 0-1.1-.2-1.6-.4 0 1.8 1.2 3.3 2.9 3.6-.5.15-1 .17-1.5.07a3.6 3.6 0 0 0 3.4 2.5A7.3 7.3 0 0 1 3 16.9a10.2 10.2 0 0 0 5.6 1.6c6.7 0 10.4-5.6 10.4-10.4v-.5c.7-.5 1.3-1.1 1.8-1.8Z" />
              </svg>
            </a>
          </span>
        </nav>

        <div className="sfoot-body">
          <svg className="sfoot-mark" viewBox="0 0 100 100" aria-hidden="true">
            <rect x="3" y="32" width="28" height="28" fill="currentColor" opacity=".45" />
            <path d="M36 2 h28 v20 a14 14 0 0 1 -14 14 h-14 z" fill="currentColor" opacity=".7" />
            <rect x="36" y="30" width="28" height="68" fill="currentColor" opacity=".7" />
            <path d="M50 98 V52 a12 12 0 0 1 12 -12 h36" fill="none" stroke="currentColor" strokeWidth="7" opacity=".45" />
            <path d="M62 98 V60 a10 10 0 0 1 10 -10 h26" fill="none" stroke="currentColor" strokeWidth="7" opacity=".45" />
            <path d="M74 98 V70 a8 8 0 0 1 8 -8 h16" fill="none" stroke="currentColor" strokeWidth="7" opacity=".45" />
          </svg>

          <div className="sfoot-branches">
            {BRANCHES.map((b) => (
              <p key={b.key}>
                <span className="tag">{b.key}</span>
                사업자등록번호: {b.bizNo}
                <i>상호:</i> 삼성흉부외과의원
                <i>대표:</i> {b.ceo}
                <i>주소:</i> {b.address}
                <i>Tel:</i> <a href={`tel:${b.tel.replace(/-/g, "")}`}>{b.tel}</a>
                {b.fax && (
                  <>
                    <i>Fax:</i> {b.fax}
                  </>
                )}
              </p>
            ))}
            <p className="sfoot-cr">
              COPYRIGHT(C) 하지정맥류 네트워크_삼성흉부외과. ALL RIGHTS RESERVED.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
