import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import QuickRail from "@/components/QuickRail";
import Deck from "@/components/Deck";
import { ACADEMIC } from "@/lib/content";

export const metadata = { title: "학술활동 | 삼성흉부외과 대전" };

export default function Page() {
  return (
    <>
      <SiteHeader active="academic" />
      <Deck title="학술활동" slides={ACADEMIC} accent="#C8102E" />
      <QuickRail />
      <SiteFooter />
    </>
  );
}
