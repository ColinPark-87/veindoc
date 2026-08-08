import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import QuickRail from "@/components/QuickRail";
import Deck from "@/components/Deck";
import { GUIDE } from "@/lib/content";

export const metadata = { title: "진료안내 | 삼성흉부외과 대전" };

export default function Page() {
  return (
    <>
      <SiteHeader active="guide" />
      <Deck title="진료안내" slides={GUIDE} accent="#F09000" />
      <QuickRail />
      <SiteFooter />
    </>
  );
}
