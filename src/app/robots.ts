import type { MetadataRoute } from "next";

/**
 * 프리뷰 단계 — 검색엔진 전면 차단.
 * 실제 도메인 붙일 때 ALLOW_INDEXING=1 로 열어준다.
 */
export default function robots(): MetadataRoute.Robots {
  const allow = process.env.ALLOW_INDEXING === "1";
  return {
    rules: allow ? { userAgent: "*", allow: "/" } : { userAgent: "*", disallow: "/" },
  };
}
