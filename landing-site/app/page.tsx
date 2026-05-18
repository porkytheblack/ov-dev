import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { Problem } from "@/components/Problem";
import { HowItWorks } from "@/components/HowItWorks";
import { Showcase } from "@/components/Showcase";
import { Features } from "@/components/Features";
import { LiveView } from "@/components/LiveView";
import { Channels } from "@/components/Channels";
import { Trust } from "@/components/Trust";
import { Waitlist } from "@/components/Waitlist";
import { Footer } from "@/components/Footer";

export default function Page() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Problem />
        <HowItWorks />
        <Showcase />
        <Features />
        <LiveView />
        <Channels />
        <Trust />
        <Waitlist />
      </main>
      <Footer />
    </>
  );
}
