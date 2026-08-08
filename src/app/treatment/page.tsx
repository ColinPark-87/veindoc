import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import QuickRail from "@/components/QuickRail";
import Deck from "@/components/Deck";
import { TREATMENT } from "@/lib/content";

export const metadata = { title: "치료법 | 삼성흉부외과 대전" };

export default function Page() {
  return (
    <>
      <SiteHeader active="treatment" />
      <Deck title="치료법" slides={TREATMENT} accent="#04A33F" />
      <QuickRail />
      <SiteFooter />
    </>
  );
}
