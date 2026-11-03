import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service — Overwatch",
  description:
    "Terms governing the Overwatch website, site-survey enquiries and quotations, and the framework for Overwatch installation, provisioning and monitoring services provided by Cradle Labs Limited.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="3 November 2026">
      <h2>1. About these Terms</h2>
      <p>
        These Terms of Service (<strong>&quot;Terms&quot;</strong>) are issued
        by <strong>Cradle Labs Limited</strong> (&quot;Cradle Labs&quot;,
        &quot;we&quot;, &quot;us&quot;, &quot;our&quot;), which provides the
        Overwatch security installation, provisioning and monitoring services.
        They govern:
      </p>
      <ul>
        <li>
          your use of this website (the <strong>&quot;Site&quot;</strong>);
        </li>
        <li>
          enquiries you submit to us, including requests for a site survey; and
        </li>
        <li>
          site surveys, designs and quotations we provide before any contract
          for services is signed.
        </li>
      </ul>
      <p>
        These Terms also explain how a contract for Overwatch services is
        formed (Section 5). <strong>They do not themselves oblige us to supply
        any services or equipment.</strong> Services are supplied only under a
        signed Service Agreement, as described in Section 5.
      </p>
      <p>
        By using the Site or submitting an enquiry, you agree to these Terms.
        If you are acting on behalf of a business or other organisation, you
        confirm that you are authorised to do so, and &quot;you&quot; includes
        that organisation.
      </p>

      <h2>2. Definitions</h2>
      <ul>
        <li>
          <strong>&quot;Customer&quot;</strong> means a person or organisation
          that has signed a Service Agreement with Cradle Labs.
        </li>
        <li>
          <strong>&quot;Overwatch Service&quot;</strong> means the services and
          deliverables we provide under a Service Agreement. Depending on the
          scope agreed, these may include site surveys, system design, supply and
          installation of cameras, servers and network equipment, installation
          and configuration of the Overwatch control software, WhatsApp and
          Telegram integration, commissioning and tuning, training, and ongoing
          managed care and support.
        </li>
        <li>
          <strong>&quot;Overwatch Software&quot;</strong> means the Overwatch
          control software, models, configurations and documentation that we
          install or make available as part of the Overwatch Service.
        </li>
        <li>
          <strong>&quot;Proposal&quot;</strong> means a written design pack,
          quotation or order form issued by Cradle Labs that sets out the scope,
          equipment, timeline and fees for a specific site.
        </li>
        <li>
          <strong>&quot;Customer Terms&quot;</strong> means our written terms
          and conditions for the supply of the Overwatch Service.
        </li>
        <li>
          <strong>&quot;Service Agreement&quot;</strong> means a Proposal
          accepted in writing by both parties, together with the Customer
          Terms and, where applicable, our{" "}
          <a href="/dpa">Data Processing Agreement</a> (the{" "}
          <strong>&quot;DPA&quot;</strong>).
        </li>
      </ul>

      <h2>3. Our services</h2>
      <p>
        The Site describes the types of work we carry out and what an Overwatch
        system can do, including example scenarios, capabilities, typical
        timelines and engagement tiers. These descriptions are provided for
        general information. Every site is different, and{" "}
        <strong>
          the scope, equipment, performance, timeline and price of any
          installation are fixed only in a Proposal
        </strong>{" "}
        that forms part of a signed Service Agreement. Illustrations, screens,
        camera images and example messages on the Site are representative
        mock-ups and do not depict real customers, incidents or people.
      </p>

      <h2>4. Enquiries, site surveys and quotations</h2>
      <h3>4.1 Enquiries</h3>
      <p>
        Submitting an enquiry or survey request does not create a contract and
        does not oblige either party to proceed. We may decline any enquiry,
        including where we cannot serve the location or the proposed use does
        not comply with Section 9.
      </p>
      <h3>4.2 Site surveys</h3>
      <p>
        Site surveys are carried out by appointment. Unless a Proposal says
        otherwise, an initial survey is provided free of charge. Where you
        arrange a survey, you confirm that:
      </p>
      <ul>
        <li>
          you own or occupy the property, or are otherwise authorised to grant
          us access to it and to discuss its security arrangements;
        </li>
        <li>
          you will tell us about any known hazards, restricted areas or site
          rules, and provide safe access to the areas to be surveyed; and
        </li>
        <li>
          we may take notes, measurements and photographs of the property for
          the sole purpose of preparing your design and quotation. We take
          reasonable care to avoid photographing people. See our{" "}
          <a href="/privacy-policy">Privacy Policy</a> for how we handle this
          information.
        </li>
      </ul>
      <h3>4.3 Designs and quotations</h3>
      <ul>
        <li>
          A quotation is valid for the period stated on it or, if none is
          stated, for 30 days. It may be revised if the site conditions,
          requirements or equipment availability differ from those assumed.
        </li>
        <li>
          Design packs, camera layouts, zone and rule plans and other documents
          we prepare remain our intellectual property and confidential
          information until the related Service Agreement is signed and paid
          for in accordance with its terms. You may use them to evaluate our
          quotation but may not share them with third parties for the purpose
          of obtaining or carrying out the work.
        </li>
        <li>
          Any indicative pricing, timelines or package descriptions given on
          the Site, during a call or during a survey are non-binding.
        </li>
      </ul>

      <h2>5. How a contract for services is formed</h2>
      <p>
        A contract for the Overwatch Service is formed only when a Proposal is
        accepted in writing by you and countersigned or confirmed in writing by
        Cradle Labs. The resulting Service Agreement:
      </p>
      <ul>
        <li>
          sets out the scope of work, equipment list, milestones, acceptance
          (commissioning) criteria, fees, payment terms, warranties and any
          managed-care service levels;
        </li>
        <li>
          includes the DPA wherever Cradle Labs processes personal data on your
          behalf, for example during installation, tuning, remote support or
          managed care, or where AI or messaging integrations are operated
          through accounts we manage; and
        </li>
        <li>
          takes precedence over these Terms in respect of the Overwatch Service.
        </li>
      </ul>

      <h2>6. How an Overwatch system handles data</h2>
      <p>
        This section summarises the standard Overwatch architecture so you can
        assess it before engaging us. The binding position is set out in your
        Service Agreement and the DPA.
      </p>
      <ul>
        <li>
          <strong>On-site recording.</strong> Cameras, recording, detection and
          storage run on a server installed at your premises. Continuous
          recordings are stored on that server and are not uploaded to Cradle
          Labs or to a cloud video service.
        </li>
        <li>
          <strong>AI analysis.</strong> In the standard configuration, short
          incident clips and still frames, not continuous recordings, are sent
          to a third-party AI vision service to produce incident summaries and
          to check critical events such as fire. Messages you send to the
          conversational assistant, together with relevant incident and camera
          data, are processed by a third-party AI language-model service. A
          fully local AI configuration, under which no video is sent to a cloud
          AI service, is available where specified in the Proposal.
        </li>
        <li>
          <strong>Messaging.</strong> Alerts, clips and replies are delivered
          through WhatsApp (operated by Meta) and/or Telegram, which process
          that content under their own terms and privacy policies.
        </li>
        <li>
          <strong>Our access.</strong> We access your system and footage only
          as needed to install, commission, tune, support and maintain it, as
          set out in the Service Agreement.
        </li>
      </ul>

      <h2>7. Third-party platforms</h2>
      <p>
        The WhatsApp and Telegram integrations depend on services operated by
        third parties. Use of WhatsApp requires a WhatsApp Business account and
        phone number approved by Meta, and is subject to Meta&apos;s business
        and messaging policies, including rules on message templates and
        messaging windows. Telegram bots are subject to Telegram&apos;s terms.
        We provision and configure these integrations, but we do not control
        those platforms and are not responsible for their availability,
        delivery times, policy decisions, account restrictions or changes to
        their features or pricing. Where a platform change affects an
        integration, we will work with Customers on a reasonable alternative as
        set out in the Service Agreement.
      </p>

      <h2>8. Equipment and software</h2>
      <ul>
        <li>
          <strong>Equipment.</strong> Title to equipment we supply passes to the
          Customer on full payment of the related fees, and risk passes on
          delivery to site, unless the Service Agreement states otherwise.
          Manufacturer warranties are passed through to the Customer where
          permitted. Our workmanship warranty and any equipment support are as
          stated in the Service Agreement.
        </li>
        <li>
          <strong>Overwatch Software.</strong> The Overwatch Software and all
          related intellectual property remain owned by or licensed to Cradle
          Labs. Customers receive a non-exclusive, non-transferable licence to
          use it at the sites, and for the purposes, set out in the Service
          Agreement. Customers may not resell, sublicense, reverse engineer or
          copy the Overwatch Software except as permitted by law or by the
          Service Agreement.
        </li>
        <li>
          <strong>Your data.</strong> As between the parties, the Customer owns
          the footage, recordings and data generated by its cameras and system.
        </li>
      </ul>

      <h2>9. Lawful and responsible use</h2>
      <p>
        Overwatch is intended for lawful security and safety purposes only.
        Every Customer is the controller of its surveillance activity and is
        responsible for:
      </p>
      <ul>
        <li>
          complying with all laws that apply to its use of cameras and
          monitoring, including data protection, CCTV, workplace-monitoring,
          biometric and privacy laws;
        </li>
        <li>
          positioning cameras only where recording is lawful, and not
          recording neighbouring private property, public areas or private
          spaces (such as bathrooms or changing areas) except as the law
          permits;
        </li>
        <li>
          displaying appropriate signage, giving any required notices and
          establishing a lawful basis for recording and processing images of
          individuals;
        </li>
        <li>
          responding to requests from people captured on camera, such as
          requests for access to footage; and
        </li>
        <li>
          ensuring that alert recipients it nominates are authorised to receive
          footage and that each of them has agreed to receive messages.
        </li>
      </ul>
      <p>
        The Overwatch Service must not be used for covert, harassing,
        discriminatory or otherwise unlawful monitoring. We may decline,
        suspend or stop work where we reasonably believe a proposed or actual
        use breaches this Section, as further set out in the Service Agreement.
        We can advise on camera placement and signage as part of the design,
        but that advice does not replace the Customer&apos;s own legal
        responsibility.
      </p>

      <h2>10. Detection, AI and safety limitations</h2>
      <p>
        Object detection, zone rules, AI-generated summaries and the
        conversational assistant are <strong>automated and probabilistic</strong>.
        They may miss events, misclassify them, raise false alarms or deliver
        alerts late, including because of camera position, lighting, weather,
        obstruction, power or network failure, or third-party platform outages.
      </p>
      <p>
        <strong>
          The Overwatch Service is an assistive monitoring tool. It is not a
          monitored alarm service, a guarding service or an emergency service,
          and it does not contact the police, fire service or other emergency
          responders.
        </strong>{" "}
        Customers must maintain appropriate independent safety measures,
        including fire detection and alarm systems where required by law, and
        must not rely on Overwatch as their sole safeguard where life, safety
        or valuable property is at risk.
      </p>

      <h2>11. Use of the Site</h2>
      <p>You agree not to:</p>
      <ul>
        <li>
          submit false information, or another person&apos;s personal
          information without their authority;
        </li>
        <li>
          attempt to gain unauthorised access to, interfere with or disrupt the
          Site or any connected system;
        </li>
        <li>
          use automated means to scrape or collect content from the Site
          without our prior written consent; or
        </li>
        <li>use the Site in any way that breaches applicable law.</li>
      </ul>

      <h2>12. Intellectual property in the Site</h2>
      <p>
        The Site&apos;s text, design, graphics, software and branding are owned
        by or licensed to Cradle Labs. &quot;Overwatch&quot; and &quot;Cradle
        Labs&quot; and related logos are trade marks of Cradle Labs Limited.
        Photographs on the Site are used under licence from their respective
        owners. You may view and print pages for your own reference, but may
        not otherwise copy, modify or republish the Site without our written
        permission, except as permitted by law.
      </p>
      <p>
        If you send us feedback or suggestions, you allow us to use them
        without obligation or payment to you.
      </p>

      <h2>13. Third-party links</h2>
      <p>
        The Site may link to third-party websites. We are not responsible for
        their content or practices, and your use of them is subject to their
        own terms.
      </p>

      <h2>14. Disclaimers</h2>
      <p>
        The Site and any information we provide before a Service Agreement is
        signed are provided &quot;as is&quot;, for general information only. To
        the fullest extent permitted by law, we give no warranty that the Site
        will be uninterrupted or error-free, or that information on it is
        complete or current. Warranties for the Overwatch Service are given
        only in the Service Agreement.
      </p>

      <h2>15. Limitation of liability</h2>
      <p>
        Nothing in these Terms limits or excludes liability for death or
        personal injury caused by negligence, for fraud or fraudulent
        misrepresentation, or for any other liability that cannot lawfully be
        limited or excluded.
      </p>
      <p>
        Subject to that, to the fullest extent permitted by law, Cradle Labs is
        not liable under these Terms for any indirect or consequential loss, or
        for loss of profits, revenue, data, goodwill or anticipated savings,
        arising from your use of the Site, an enquiry, a site survey or a
        quotation. Our liability in connection with the Overwatch Service is
        governed exclusively by the Service Agreement.
      </p>

      <h2>16. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time and will revise the
        &quot;Last updated&quot; date when we do. Changes do not affect a
        Service Agreement that has already been signed, which can be varied
        only as it provides.
      </p>

      <h2>17. Governing law and jurisdiction</h2>
      <p>
        These Terms, and any dispute or claim (including non-contractual
        disputes or claims) arising out of or in connection with them, are
        governed by the laws of the jurisdiction in which Cradle Labs Limited
        is incorporated, and the courts of that jurisdiction have exclusive
        jurisdiction. This does not limit any mandatory rights you have under
        the law of your country of residence.
      </p>

      <h2>18. Contact</h2>
      <p>
        Questions about these Terms can be sent to Cradle Labs Limited at{" "}
        <a href="mailto:hello@dterminal.net">hello@dterminal.net</a>.
      </p>
    </LegalPage>
  );
}
