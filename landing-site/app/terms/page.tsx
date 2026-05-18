import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service — Overwatch",
  description:
    "Terms of Service for the Overwatch waitlist and marketing website, operated by Cradle Labs Limited.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="18 May 2026">
      <p className="lead-note">
        This document is provided for general information only and is a
        template. It does not constitute legal advice. Cradle Labs Limited
        should have it reviewed and adapted by a qualified lawyer before launch.
      </p>

      <h2>1. About these Terms</h2>
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your access to and use
        of the Overwatch waitlist and marketing website (the &quot;Site&quot;).
        The Site is operated by <strong>Cradle Labs Limited</strong>
        (&quot;Cradle Labs&quot;, &quot;we&quot;, &quot;us&quot;,
        &quot;our&quot;).
      </p>
      <p>
        By accessing or using the Site, or by submitting your details to our
        waitlist, you confirm that you have read, understood and agree to be
        bound by these Terms. If you do not agree, please do not use the Site.
      </p>
      <p>
        <strong>Email:</strong>{" "}
        <a href="mailto:hello@dterminal.net">hello@dterminal.net</a>
      </p>

      <h2>2. Eligibility</h2>
      <p>
        The Site is intended for individuals who are{" "}
        <strong>at least 16 years old</strong>. By using the Site or joining the
        waitlist, you confirm that you are 16 or older and that the information
        you provide is accurate and your own.
      </p>

      <h2>3. The waitlist</h2>
      <p>
        Overwatch is described publicly as multi-camera AI surveillance software
        that detects incidents on security cameras and notifies users via
        WhatsApp and Telegram, with a conversational AI assistant.{" "}
        <strong>Overwatch is not yet generally available.</strong> The current
        purpose of the Site is to allow you to register interest and join a
        waitlist.
      </p>
      <p>You acknowledge and agree that:</p>
      <ul>
        <li>
          Joining the waitlist does <strong>not</strong> guarantee access to
          Overwatch, or access within any particular timeframe, or at all.
        </li>
        <li>
          No purchase is made and{" "}
          <strong>no contract for the supply of Overwatch is formed</strong> by
          joining the waitlist.
        </li>
        <li>
          No pricing, feature, availability or launch-date commitment is made to
          you. Any such information, if provided, is indicative only and may
          change.
        </li>
        <li>
          We may change, suspend, limit or discontinue the waitlist, any
          waitlist benefit, or the Overwatch product (in whole or in part) at
          any time, without liability to you.
        </li>
        <li>
          If and when Overwatch becomes available, separate terms will apply and
          will be presented to you at that time.
        </li>
        <li>
          The Overwatch product is offered in the deployment models described in
          Section 4. <strong>Separate Product Terms, an Order or written quote
          (covering any fees, equipment and installation), and, for the
          hosted/managed model, a Data Processing Agreement, are separate
          documents that are binding only when agreed and signed by you and
          Cradle Labs.</strong> They are not entered into through the Site or by
          joining the waitlist.
        </li>
      </ul>

      <h2>4. The Overwatch service and deployment models</h2>
      <p>
        Overwatch is multi-camera AI surveillance software that is intended to
        detect incidents on connected security cameras and notify users via
        WhatsApp and Telegram, with a conversational AI assistant (the{" "}
        <strong>&quot;Overwatch Service&quot;</strong>). This section describes
        the intended offering so that you can understand how Overwatch is
        expected to work. It is{" "}
        <strong>forward-looking and provided for information only</strong>.{" "}
        <strong>
          Overwatch is not yet generally available, and nothing on the Site or
          in the waitlist provides, licenses or sells the Overwatch Service to
          you.
        </strong>
      </p>
      <p>
        <strong>No product contract formed via the Site.</strong> No contract
        for the supply of the Overwatch Service, and no licence to use it, is
        created by your use of the Site, by joining the waitlist, or by any
        description, demonstration, quote or indicative pricing we may provide.
        Before the Overwatch Service is provided to any customer (the{" "}
        <strong>&quot;Customer&quot;</strong>), the Customer and Cradle Labs
        must enter into separate written product terms (the{" "}
        <strong>&quot;Product Terms&quot;</strong>), an order or quote covering
        scope and any fees, equipment and installation (an{" "}
        <strong>&quot;Order&quot;</strong>), and, where Cradle Labs processes
        personal data on the Customer&apos;s behalf, a data processing agreement
        (the <strong>&quot;DPA&quot;</strong>). The Product Terms, Order and DPA,
        once agreed in writing, govern the Overwatch Service and prevail over
        these Terms in respect of the Overwatch Service. Until they are agreed
        and signed, Cradle Labs is under no obligation to provide the Overwatch
        Service, and no Product Terms, Order or DPA is entered into through the
        Site or by joining the waitlist.
      </p>
      <p>
        When offered, the Overwatch Service is expected to be made available in
        two deployment models.
      </p>
      <h3>(a) Self-hosted / on-premises</h3>
      <p>
        Cradle Labs sets up the Overwatch system and connects the Customer&apos;s
        cameras. All video capture, processing and storage runs on the{" "}
        <strong>Customer&apos;s own hardware and infrastructure</strong>; video
        is not ingested by or processed on Cradle Labs&apos; servers in this
        model. There may be{" "}
        <strong>installation costs and costs for required equipment</strong>,
        which are quoted and agreed separately under an Order (see Section 5).
        The Customer is solely responsible for its own hardware, networks and
        infrastructure and their configuration, availability and security; for
        lawful operation of its cameras; and for providing any notices and
        obtaining any consents or authorisations required for persons who may be
        recorded. Cradle Labs&apos; role in this model is limited to the agreed
        setup and any maintenance or support that is separately agreed in
        writing.
      </p>
      <h3>(b) Hosted / managed</h3>
      <p>
        <strong>
          Video ingestion and processing occur on Cradle Labs&apos; servers.
        </strong>{" "}
        To use this model, the Customer must authorise and expressly consent to
        Cradle Labs (and its sub-processors) capturing, ingesting, transmitting,
        processing and storing the Customer&apos;s video, and to Cradle Labs
        forwarding video and related data to third-party
        artificial-intelligence providers for the purpose of detecting
        incidents and operating the Overwatch Service. Such third-party AI
        providers are engaged under contractual terms that{" "}
        <strong>
          restrict them from using the Customer&apos;s data or content to train,
          fine-tune or improve their own models
        </strong>
        , and that require them to process the data only to provide the relevant
        functionality to Cradle Labs. We maintain a list of sub-processors and
        will give the Customer prior notice of any intended addition or
        replacement, with the opportunity to object, as set out in the DPA.
        This processing is governed by the DPA. As between the parties, the{" "}
        <strong>Customer remains the controller</strong> of its footage and is
        responsible for establishing a lawful basis for recording and processing
        and for providing any notices and obtaining any consents required for
        recorded individuals. Cradle Labs&apos; processing of personal data in
        this model is carried out as a processor and is described in our Privacy
        Policy (Section 3) and the DPA.
      </p>
      <p>
        <strong>Ownership and intellectual property.</strong> The Overwatch
        Service, the Overwatch software, models, configurations, documentation
        and all related intellectual property are and remain owned by or
        licensed to <strong>Cradle Labs Limited</strong>. If and when the
        Overwatch Service is provided, the Customer receives only a limited,
        non-exclusive, non-transferable right to use it strictly in accordance
        with the Product Terms, and acquires no other rights. As between the
        parties, the <strong>Customer owns the video footage it records</strong>{" "}
        through its own cameras. The Customer grants Cradle Labs only the rights
        necessary to provide, secure, maintain and support the Overwatch Service
        in the chosen deployment model, as further set out in the Product Terms
        and DPA.
      </p>
      <p>
        <strong>
          Customer responsibilities and acceptable use of the Overwatch
          Service.
        </strong>{" "}
        The Overwatch Service is intended for{" "}
        <strong>lawful surveillance and security purposes only</strong>. Any
        Customer using the Overwatch Service must: comply with all applicable
        laws, including privacy, data protection, CCTV/video-surveillance,
        workplace-monitoring and biometric laws; install and operate cameras
        only in locations and in a manner permitted by law; provide all required
        signage, notices and information and obtain all required consents or
        other lawful bases for recording and processing individuals; and not use
        the Overwatch Service for unlawful, covert, harassing or discriminatory
        monitoring, or in any way that infringes the rights of others. Where the
        Customer&apos;s use involves biometric or special-category data (for
        example, facial recognition), the Customer is responsible for
        identifying a valid condition under Article 9 of the UK/EU GDPR and for
        any required appropriate-policy document or data protection impact
        assessment. Cradle Labs is not responsible for how a Customer deploys,
        positions or uses cameras or the Overwatch Service, or for the
        Customer&apos;s compliance with laws applicable to its own surveillance
        activities.
      </p>
      <p>
        <strong>AI output limitations.</strong> Incident detection and the
        conversational AI assistant are{" "}
        <strong>probabilistic and automated</strong>. They may produce
        inaccurate, incomplete, delayed, false-positive or false-negative
        results, and <strong>do not constitute a guarantee</strong> that any
        incident, intrusion, hazard or event will be detected, classified or
        notified correctly or at all. The Overwatch Service is an{" "}
        <strong>assistive tool only</strong> and is{" "}
        <strong>
          not a monitored alarm or guarding service and not a substitute for
          emergency services, professional monitoring or human security
          personnel
        </strong>
        , particularly where life, safety or valuable property is at risk. The
        Customer is responsible for maintaining appropriate independent safety,
        security and emergency measures and must not rely on the Overwatch
        Service as its sole safeguard. These limitations are in addition to, and
        to be read with, the Disclaimers and Limitation of liability sections of
        these Terms.
      </p>

      <h2>5. Fees, equipment and installation</h2>
      <p>
        The Overwatch Service is expected to be a{" "}
        <strong>paid product</strong>, and certain deployment models may require{" "}
        <strong>equipment</strong> and <strong>installation work</strong>. Any
        fees, charges, equipment costs, installation costs and related terms
        will be set out in an <strong>Order or written quote</strong> agreed
        between Cradle Labs and the Customer before the Overwatch Service is
        provided.
      </p>
      <p>You acknowledge and agree that:</p>
      <ul>
        <li>
          Any pricing, packages, equipment lists, installation scope, service
          levels, features, timelines and availability that may be referred to
          on the Site, in the waitlist, or in any discussion, demonstration or
          indicative quote are <strong>indicative and non-binding</strong>, are
          provided for general information only, and{" "}
          <strong>may change or be withdrawn at any time</strong>.
        </li>
        <li>
          <strong>
            No fee, equipment or installation commitment is binding on either
            party unless and until it is set out in a written Order agreed and
            signed by the Customer and Cradle Labs.
          </strong>{" "}
          Quotations are valid only as, and for the period, expressly stated in
          them.
        </li>
        <li>
          <strong>
            No charge is or will be incurred by using the Site or joining the
            waitlist.
          </strong>{" "}
          Joining the waitlist does not reserve pricing, equipment, installation
          capacity or availability, and does not entitle you to the Overwatch
          Service on any particular terms or at all.
        </li>
        <li>
          Equipment supply, installation, maintenance and support (if any) will
          be provided only as expressly described in the applicable Order and
          Product Terms, and any third-party equipment may additionally be
          subject to the relevant manufacturer&apos;s or supplier&apos;s terms
          and warranties.
        </li>
      </ul>

      <h2>6. Acceptable use of the Site</h2>
      <p>
        You agree to use the Site only for lawful purposes and in a way that
        does not infringe the rights of, or restrict or inhibit the use of the
        Site by, anyone else. In particular, you agree not to:
      </p>
      <ul>
        <li>
          submit false, misleading or third-party personal information without
          authority;
        </li>
        <li>
          use the Site to transmit any unlawful, abusive, infringing or
          malicious content;
        </li>
        <li>
          attempt to gain unauthorised access to, interfere with, damage or
          disrupt the Site, its servers, or any connected systems or networks;
        </li>
        <li>
          use any automated means (bots, scrapers) to access or collect data
          from the Site without our prior written consent; or
        </li>
        <li>use the Site in any way that breaches applicable law or regulation.</li>
      </ul>
      <p>
        We may suspend or remove your waitlist entry or restrict your access to
        the Site if we reasonably believe you have breached these Terms.
      </p>

      <h2>7. Intellectual property</h2>
      <p>
        All content on the Site — including text, graphics, logos, layout,
        design, and software — is owned by or licensed to Cradle Labs and is
        protected by intellectual property laws. The names{" "}
        <strong>&quot;Overwatch&quot;</strong> and{" "}
        <strong>&quot;Cradle Labs&quot;</strong>, and related logos and
        branding, are trade marks of <strong>Cradle Labs Limited</strong>.
      </p>
      <p>
        You may view and use the Site for your own personal, non-commercial
        purposes. You may not copy, reproduce, modify, distribute, republish or
        otherwise exploit any part of the Site without our prior written
        permission, except as permitted by applicable law.
      </p>

      <h2>8. Your submissions and feedback</h2>
      <p>
        When you join the waitlist you submit your email address (and optionally
        your name). Our handling of that information is described in our Privacy
        Policy.
      </p>
      <p>
        If you send us feedback, suggestions, ideas or other materials about the
        Site or Overwatch (&quot;Feedback&quot;), you grant Cradle Labs a
        worldwide, perpetual, irrevocable, royalty-free licence to use,
        reproduce and incorporate that Feedback for any purpose, without any
        obligation, attribution or compensation to you. You confirm that any
        Feedback you provide is your own and does not infringe the rights of any
        third party.
      </p>

      <h2>9. Third-party links</h2>
      <p>
        The Site may contain links to third-party websites or services that are
        not operated or controlled by Cradle Labs. We provide these links for
        convenience only and are not responsible for the content, policies or
        practices of any third-party site. Accessing third-party sites is at
        your own risk and subject to their terms.
      </p>

      <h2>10. Disclaimers</h2>
      <p>
        The Site is provided on an <strong>&quot;as is&quot;</strong> and{" "}
        <strong>&quot;as available&quot;</strong> basis. To the fullest extent
        permitted by law, Cradle Labs makes no warranties or representations,
        express or implied, regarding the Site, including as to accuracy,
        completeness, availability, fitness for a particular purpose, or that
        the Site will be uninterrupted, secure or error-free. Any descriptions
        of Overwatch are forward-looking and subject to change.
      </p>
      <p>
        Without limiting the above, any descriptions of the Overwatch Service
        and its deployment models in Section 4 are{" "}
        <strong>forward-looking, indicative and subject to change</strong>, and
        the Overwatch Service is not provided through the Site. To the fullest
        extent permitted by law, Cradle Labs makes{" "}
        <strong>
          no warranty or representation that the Overwatch Service will detect,
          classify or notify any incident, intrusion, hazard or event
          accurately, completely, in time or at all
        </strong>
        . Incident detection and the conversational AI assistant are{" "}
        <strong>probabilistic and automated</strong>, may produce false
        positives, false negatives, inaccurate or delayed results, and{" "}
        <strong>do not guarantee safety or security</strong>. The Overwatch
        Service is{" "}
        <strong>
          not a monitored alarm, guarding or emergency service and is not a
          substitute for emergency services or human security personnel
        </strong>
        . Any provision of the Overwatch Service will be governed by the
        applicable Product Terms, Order and DPA, not by these Terms, and is
        further addressed in Section 11.
      </p>

      <h2>11. Limitation of liability</h2>
      <p>
        Nothing in these Terms excludes or limits liability that cannot lawfully
        be excluded or limited, including liability for death or personal injury
        caused by negligence, or for fraud.
      </p>
      <p>
        Subject to the above, to the fullest extent permitted by law, Cradle
        Labs will not be liable for any indirect, incidental, special or
        consequential loss, or for any loss of profits, revenue, data, goodwill
        or anticipated savings, arising out of or in connection with your use of
        (or inability to use) the Site or the waitlist. The Site is provided
        free of charge, and our total aggregate liability arising out of or in
        connection with the Site and these Terms is limited to the maximum
        extent permitted by law.
      </p>
      <p>
        For the avoidance of doubt, these Terms and the limitations in this
        section relate to your use of the Site and the waitlist. The Site and
        waitlist are provided free of charge, and the Overwatch Service is{" "}
        <strong>not provided under these Terms</strong>. Cradle Labs accepts{" "}
        <strong>
          no liability arising out of or in connection with the Overwatch
          Service, its deployment models, incident detection, AI outputs,
          equipment or installation
        </strong>{" "}
        under these Terms; liability in respect of the Overwatch Service is
        dealt with exclusively in the separately agreed Product Terms, Order and
        DPA. Nothing in this section excludes or limits any liability that
        cannot lawfully be excluded or limited, including liability for death or
        personal injury caused by negligence, or for fraud.
      </p>

      <h2>12. Indemnity</h2>
      <p>
        You agree to indemnify and hold harmless Cradle Labs against reasonable
        losses, damages and costs arising from your misuse of the Site or your
        breach of these Terms or of applicable law.
      </p>

      <h2>13. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. Where we do, we will revise
        the &quot;Last updated&quot; date above and, where appropriate, take
        reasonable steps to notify you. Your continued use of the Site after
        changes take effect constitutes acceptance of the revised Terms.
      </p>

      <h2>14. Governing law and jurisdiction</h2>
      <p>
        These Terms, and any dispute or claim (including non-contractual
        disputes or claims) arising out of or in connection with them, their
        subject matter or their formation, shall be governed by and construed
        in accordance with the laws of the jurisdiction in which Cradle Labs
        Limited is incorporated.
      </p>
      <p>
        You and Cradle Labs Limited each irrevocably agree that the courts of
        that jurisdiction shall have exclusive jurisdiction to hear and
        determine any such dispute or claim. Nothing in this clause limits or
        excludes any mandatory statutory rights, including consumer protection
        rights, available to you under the law of your country of residence.
      </p>

      <h2>15. Contact</h2>
      <p>
        If you have any questions about these Terms, please contact Cradle Labs
        Limited at:
      </p>
      <p>
        <strong>Email:</strong>{" "}
        <a href="mailto:hello@dterminal.net">hello@dterminal.net</a>
      </p>
    </LegalPage>
  );
}
