import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { Services } from "@/components/Services";
import { Scenarios } from "@/components/Scenarios";
import { Capabilities } from "@/components/Capabilities";
import { Process } from "@/components/Process";
import { Security } from "@/components/Security";
import { Engagements } from "@/components/Engagements";
import { Faq } from "@/components/Faq";
import { Contact } from "@/components/Contact";
import { Footer } from "@/components/Footer";

export default function Page() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Services />
        <Scenarios />
        <Capabilities />
        <Process />
        <Security />
        <Engagements />
        <Faq />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
