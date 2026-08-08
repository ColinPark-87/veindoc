import LoginForm from "./LoginForm";

export const metadata = { title: "관리자 로그인 | 삼성흉부외과 대전" };
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  const { e } = await searchParams;
  return <LoginForm denied={e === "denied"} />;
}
