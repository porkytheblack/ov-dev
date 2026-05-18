import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { TrustStrip } from "@/components/TrustStrip";
import { Problem } from "@/components/Problem";
import { HowItWorks } from "@/components/HowItWorks";
import { Showcase } from "@/components/Showcase";
import { Features } from "@/components/Features";
import { LiveView } from "@/components/LiveView";
import { Channels } from "@/components/Channels";
import { Privacy } from "@/components/Privacy";
import { CTA } from "@/components/CTA";
import { Footer } from "@/components/Footer";

export default function Page() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <TrustStrip />
        <Problem />
        <HowItWorks />
        <Showcase />
        <Features />
        <LiveView />
        <Channels />
        <Privacy />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
