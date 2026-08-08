import type { Metadata, Viewport } from "next";
import SelfCheck from "@/components/SelfCheck";
import Tracker from "@/components/Tracker";
import "./globals.css";

export const metadata: Metadata = {
  title: "삼성흉부외과 대전 | 하지정맥류 클리닉",
  description:
    "하지정맥류 한 길 20년, 40,000 케이스. 대전 둔산 삼성흉부외과 — 진단부터 재수술까지 한 사람이 끝까지 봅니다.",
  openGraph: {
    title: "삼성흉부외과 대전 | 하지정맥류 클리닉",
    description: "하지정맥류 한 길 20년, 40,000 케이스. 대전 둔산 삼성흉부외과.",
    type: "website",
    locale: "ko_KR",
  },
  // 프리뷰 단계: 색인 차단. 실제 도메인 연결 시 ALLOW_INDEXING=1
  robots:
    process.env.ALLOW_INDEXING === "1"
      ? { index: true, follow: true }
      : { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0070BC",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <head>
        {/* Pretendard — 한글 본문 가독성. 추후 자체 호스팅 전환 */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"
        />
      </head>
      <body>
        {children}
        {/* 자가체크는 전 페이지 공용 — 헤더 버튼이 이벤트로 연다 */}
        <SelfCheck />
        <Tracker />
      </body>
    </html>
  );
}
