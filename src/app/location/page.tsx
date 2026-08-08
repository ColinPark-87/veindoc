import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import QuickRail from "@/components/QuickRail";
import Deck from "@/components/Deck";
import { LOCATION } from "@/lib/content";

export const metadata = { title: "오시는 길 | 삼성흉부외과 대전" };

export default function Page() {
  return (
    <>
      <SiteHeader active="location" />
      <Deck title="오시는 길" slides={LOCATION} accent="#7A3FD1" />
      <QuickRail />
      <SiteFooter />
    </>
  );
}
