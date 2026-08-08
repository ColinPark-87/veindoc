import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import QuickRail from "@/components/QuickRail";
import Deck from "@/components/Deck";
import { VEIN } from "@/lib/content";

export const metadata = { title: "하지정맥류 | 삼성흉부외과 대전" };

export default function Page() {
  return (
    <>
      <SiteHeader active="vein" />
      <Deck title="하지정맥류" slides={VEIN} accent="#0070BC" />
      <QuickRail />
      <SiteFooter />
    </>
  );
}
