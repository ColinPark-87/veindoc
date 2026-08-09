import { redirect } from "next/navigation";
import Link from "next/link";
import { getMe, isAdmin, isStaff } from "@/lib/auth";
import { signOutAdmin } from "../actions";

export const metadata = { title: "관리자 | 삼성흉부외과 대전" };
export const dynamic = "force-dynamic";

const ADMIN_NAV = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/staff-activity", label: "직원 실적" },
  { href: "/admin/logs", label: "작업 로그" },
  { href: "/admin/members", label: "계정 관리" },
  { href: "/admin/settings", label: "진료시간" },
];

const STAFF_NAV = [
  { href: "/admin/today", label: "알림" },
  { href: "/admin/calendar", label: "진료 캘린더" },
  { href: "/admin/patients", label: "환자 관리" },
  { href: "/admin/appointments", label: "예약 관리" },
  { href: "/admin/inquiries", label: "상담 요청" },
  { href: "/admin/sms", label: "문자 발송" },
  { href: "/admin/posts", label: "게시판" },
  { href: "/admin/reviews", label: "후기 관리" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();

  // 로그인 페이지는 이 레이아웃을 쓰지 않는다(별도 route group)
  if (!me) redirect("/admin/login");
  if (!isStaff(me)) redirect("/admin/login?e=denied");

  const nav = isAdmin(me) ? [...ADMIN_NAV, ...STAFF_NAV] : STAFF_NAV;

  return (
    <div className="adm">
      <aside className="adm-side">
        <Link className="adm-brand" href="/admin">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <rect x="3" y="32" width="28" height="28" fill="#04A33F" />
            <path d="M36 2 h28 v20 a14 14 0 0 1 -14 14 h-14 z" fill="#0070BC" />
            <rect x="36" y="30" width="28" height="68" fill="#0070BC" />
            <path d="M50 98 V52 a12 12 0 0 1 12 -12 h36" fill="none" stroke="#04A33F" strokeWidth="7" />
            <path d="M62 98 V60 a10 10 0 0 1 10 -10 h26" fill="none" stroke="#04A33F" strokeWidth="7" />
            <path d="M74 98 V70 a8 8 0 0 1 8 -8 h16" fill="none" stroke="#04A33F" strokeWidth="7" />
          </svg>
          <span>
            <b>삼성흉부외과</b>
            <i>{isAdmin(me) ? "총괄 관리자" : "직원"}</i>
          </span>
        </Link>

        <nav className="adm-nav">
          {nav.map((n) => (
            <Link key={n.href} href={n.href}>
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="adm-me">
          <b>{me.name || me.email}</b>
          <span>
            {me.branch} · {me.role === "admin" ? "관리자" : "직원"}
          </span>
          <form action={signOutAdmin}>
            <button type="submit">로그아웃</button>
          </form>
          <Link className="adm-site" href="/">
            사이트 보기 →
          </Link>
        </div>
      </aside>

      <main className="adm-main">{children}</main>
    </div>
  );
}
