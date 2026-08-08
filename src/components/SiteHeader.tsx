import Link from "next/link";
import HeaderCta from "./HeaderCta";
import HeaderLogin from "./HeaderLogin";
import { getMe, isStaff } from "@/lib/auth";

export const NAV = [
  { key: "vein", href: "/vein", label: "하지정맥류" },
  { key: "treatment", href: "/treatment", label: "치료법" },
  { key: "reviews", href: "/reviews", label: "치료후기" },
  { key: "academic", href: "/academic", label: "학술활동" },
  { key: "guide", href: "/guide", label: "진료안내" },
  { key: "location", href: "/location", label: "오시는 길" },
] as const;

export type NavKey = (typeof NAV)[number]["key"] | "home";

export default async function SiteHeader({ active }: { active?: NavKey }) {
  const me = await getMe();
  return (
    <header>
      <div className="shell hbar">
        <Link className="brand" href="/">
          <svg viewBox="0 0 100 100" aria-label="삼성흉부외과">
            <rect x="3" y="32" width="28" height="28" fill="#04A33F" />
            <path d="M36 2 h28 v20 a14 14 0 0 1 -14 14 h-14 z" fill="#0070BC" />
            <rect x="36" y="30" width="28" height="68" fill="#0070BC" />
            <path d="M50 98 V52 a12 12 0 0 1 12 -12 h36" fill="none" stroke="#04A33F" strokeWidth="7" />
            <path d="M62 98 V60 a10 10 0 0 1 10 -10 h26" fill="none" stroke="#04A33F" strokeWidth="7" />
            <path d="M74 98 V70 a8 8 0 0 1 8 -8 h16" fill="none" stroke="#04A33F" strokeWidth="7" />
          </svg>
          <span className="nm">
            <b>삼성흉부외과</b>
            <i>대전 · SINCE 2002</i>
          </span>
        </Link>
        <nav className="hnav">
          {NAV.map((n) => (
            <Link key={n.key} href={n.href} className={active === n.key ? "on" : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>
        <HeaderCta />
        <HeaderLogin email={me?.email} isStaff={isStaff(me)} />
      </div>

      {/* 모바일 전용 탭 스트립 — 데스크톱 hnav가 숨겨지면 길을 잃지 않도록 */}
      <nav className="mnav">
        {NAV.map((n) => (
          <Link key={n.key} href={n.href} className={active === n.key ? "on" : undefined}>
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
