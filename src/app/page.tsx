import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import QuickRail from "@/components/QuickRail";
import Hero from "@/components/Hero";

export default function Home() {
  return (
    <>
      <SiteHeader active="home" />
      <Hero />
      <QuickRail />
      <SiteFooter />
    </>
  );
}
