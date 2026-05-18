import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy — Overwatch",
  description:
    "Privacy Policy for the Overwatch waitlist and marketing website, operated by Cradle Labs Limited.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="18 May 2026">
      <p className="lead-note">
        This document is provided for general information only and is a
        template. It does not constitute legal advice. Cradle Labs Limited
        should have it reviewed and adapted by a qualified lawyer before launch.
      </p>

      <h2>1. Who we are</h2>
      <p>
        This Privacy Policy explains how <strong>Cradle Labs Limited</strong>{" "}
        (&quot;Cradle Labs&quot;, &quot;we&quot;, &quot;us&quot;,
        &quot;our&quot;) collects and uses personal information when you visit
        the Overwatch waitlist and marketing website (the &quot;Site&quot;) or
        join our waitlist.
      </p>
      <p>
        Cradle Labs is the controller responsible for your personal information.
      </p>
      <p>
        <strong>Email:</strong>{" "}
        <a href="mailto:hello@dterminal.net">hello@dterminal.net</a>
      </p>

      <h2>2. Scope</h2>
      <p>
        This Policy applies to the marketing Site and the waitlist signup only.
        Overwatch is not yet generally available, and the Site does not provide
        the product or a user account. Separate privacy terms will apply to the
        Overwatch product if and when it launches.
      </p>
      <p>
        The two intended Overwatch deployment models are described in Section 3
        for transparency. Those models, including any processing of camera or
        video data, are not provided through this Site and will be governed by
        separate binding Product Terms, an Order and a Data Processing Agreement,
        which must be accepted before any hosted processing of a Customer&apos;s
        video occurs.
      </p>

      <h2>3. The Overwatch service — deployment models and video data</h2>
      <p>
        This section describes how the Overwatch service (as defined in our
        Terms of Service) is <strong>intended</strong> to handle camera and
        video data once it becomes available. It is provided for transparency so
        you can understand the data-protection implications of each model. The
        terms <strong>&quot;Overwatch Service&quot;</strong>,{" "}
        <strong>&quot;Customer&quot;</strong>,{" "}
        <strong>&quot;Product Terms&quot;</strong>,{" "}
        <strong>&quot;Order&quot;</strong> and{" "}
        <strong>&quot;DPA&quot;</strong> have the meanings given in our Terms of
        Service (Section 4).
      </p>
      <p>
        <strong>Overwatch is not yet generally available.</strong> This Site is
        a waitlist and marketing site only.{" "}
        <strong>
          Nothing on this Site, and nothing about joining the waitlist, results
          in Cradle Labs capturing, ingesting, receiving, processing or storing
          any camera footage or video.
        </strong>{" "}
        The arrangements described below apply only under the Overwatch Service
        and are governed by separate, binding Product Terms, an Order and a{" "}
        <a href="/dpa">Data Processing Agreement</a> (DPA), which will be
        provided to, and must be accepted by, a Customer{" "}
        <strong>before</strong> any hosted processing of
        that Customer&apos;s video takes place. This summary does not create any
        contractual obligation and may change before launch; the Product Terms,
        Order and DPA will prevail in the event of any inconsistency.
      </p>
      <p>Overwatch is intended to be offered in two deployment models.</p>

      <h3>3.1 Self-hosted / on-premises</h3>
      <p>
        In this model, Cradle Labs sets up the Overwatch system and connects the
        Customer&apos;s cameras to it. There may be installation costs and costs
        for any required equipment. All video ingestion, processing, incident
        detection, clip generation and storage take place entirely on the{" "}
        <strong>Customer&apos;s own hardware</strong> and within the
        Customer&apos;s own environment.
      </p>
      <p>
        In the ordinary course,{" "}
        <strong>
          Cradle Labs does not ingest, receive, store or process the
          Customer&apos;s video
        </strong>{" "}
        in this model. Cradle Labs&apos; involvement is limited to initial setup
        and to any maintenance or support that is separately agreed. The{" "}
        <strong>Customer is the data controller</strong> for the footage and is
        responsible for its lawful use (including any required signage, notices,
        lawful basis and data-subject rights relating to people captured on
        camera). Where the Customer&apos;s use involves biometric or
        special-category data (for example, facial recognition), the Customer is
        responsible for identifying a valid condition under Article 9 of the
        UK/EU GDPR and for any required appropriate-policy document or data
        protection impact assessment.
      </p>
      <p>
        Any access by Cradle Labs to a Customer&apos;s system or footage (for
        example, during installation, configuration, troubleshooting or agreed
        support) is{" "}
        <strong>
          limited, occasional, purpose-bound, and carried out only as necessary
        </strong>{" "}
        for that task, under appropriate confidentiality and contractual terms.
        Where such access involves Cradle Labs processing personal data on the
        Customer&apos;s behalf, it is governed by the applicable Product Terms
        and DPA.
      </p>

      <h3>3.2 Hosted / managed</h3>
      <p>
        In this model,{" "}
        <strong>
          video ingestion and processing take place on Cradle Labs&apos;
          servers
        </strong>
        . The Customer must provide{" "}
        <strong>explicit, informed consent and authorisation</strong> for Cradle
        Labs to capture, ingest, process, analyse and forward the
        Customer&apos;s camera video for the purpose of providing the Overwatch
        Service (including incident detection and notifications).
      </p>
      <p>
        Providing the service includes{" "}
        <strong>
          forwarding relevant video, frames or derived data to carefully
          selected third-party artificial-intelligence providers, acting as
          sub-processors
        </strong>
        , so that detection and scene understanding can be performed. These AI
        providers are{" "}
        <strong>
          contractually restricted from using the data to train, develop or
          improve their own models or services
        </strong>{" "}
        and may process the data <strong>only</strong> to provide the
        detection/understanding functionality back to Cradle Labs, in accordance
        with Cradle Labs&apos; instructions, and for no other purpose. Overwatch&apos;s
        AI generates probabilistic detections to assist the Customer; it does not
        make decisions producing legal or similarly significant effects on
        individuals, and any such use would be the Customer&apos;s
        responsibility under its own lawful basis and Article 22 obligations.
      </p>
      <p>In the hosted model:</p>
      <ul>
        <li>
          the <strong>Customer is the data controller</strong> for its camera
          footage and the people captured in it;
        </li>
        <li>
          <strong>Cradle Labs acts as a processor</strong> acting on the
          Customer&apos;s documented instructions in respect of that footage,
          and processes that footage only on those documented instructions
          except where required by law (Cradle Labs may act as a controller only
          for limited, ancillary purposes such as security, service integrity,
          billing and legal compliance);
        </li>
        <li>
          processing is governed by a{" "}
          <strong>Data Processing Agreement (DPA)</strong> entered into at
          onboarding, which sets out the subject-matter and duration of
          processing, the documented list of sub-processors (including AI
          providers), the applicable technical and organisational security
          measures, confidentiality obligations, assistance with data-subject
          rights, <strong>limited retention</strong>,{" "}
          <strong>deletion or return of footage on termination</strong>, and{" "}
          <strong>appropriate safeguards for any international transfers</strong>;
        </li>
        <li>
          we maintain a list of sub-processors and will give the Customer prior
          notice of any intended addition or replacement, with the opportunity
          to object, as set out in the DPA;
        </li>
        <li>
          data-subject requests relating to footage are directed to the Customer
          as controller; we will assist the Customer in responding as required
          by the DPA and Articles 28 and 12–23 of the UK/EU GDPR; and
        </li>
        <li>
          we will notify the Customer of personal data breaches affecting
          footage without undue delay, as set out in the DPA.
        </li>
      </ul>

      <h3>3.3 Lawful bases (intended, hosted model)</h3>
      <p>
        When the hosted product is offered, Cradle Labs anticipates relying on
        the following lawful bases under UK and EU GDPR for its own processing,
        while the Customer remains responsible for identifying and maintaining a
        lawful basis for the underlying camera surveillance as controller:
      </p>
      <ul>
        <li>
          <strong>Consent / authorisation</strong> — for capturing, ingesting
          and forwarding a Customer&apos;s camera video for hosted processing,
          which requires the Customer&apos;s explicit, informed authorisation
          before any such processing begins;
        </li>
        <li>
          <strong>Performance of a contract</strong> — to provide, operate,
          maintain and support the Overwatch Service the Customer has signed up
          for;
        </li>
        <li>
          <strong>Legitimate interests</strong> — for ancillary purposes such as
          securing the service, preventing misuse and fraud, ensuring service
          integrity, and defending legal claims, where these are not overridden
          by the rights and interests of the individuals concerned;
        </li>
        <li>
          <strong>Legal obligation</strong> — where Cradle Labs must process or
          disclose data to comply with applicable law.
        </li>
      </ul>
      <p>
        The definitive lawful bases, roles, sub-processor list and safeguards
        for the hosted product will be set out in the Product Terms and DPA
        provided at onboarding.
      </p>

      <h2>4. What we collect</h2>
      <ul>
        <li>
          <strong>Waitlist information:</strong> the email address you submit to
          join the waitlist, and your name if you choose to provide it.
        </li>
        <li>
          <strong>Communications:</strong> the content of any messages, feedback
          or enquiries you send to us, and our correspondence with you.
        </li>
        <li>
          <strong>Technical and usage data:</strong> information collected
          automatically when you visit the Site, such as IP address, device and
          browser type, operating system, referring pages, and pages viewed,
          gathered through server logs and privacy-respecting analytics.
        </li>
      </ul>
      <p>
        We do not intentionally collect special category (sensitive) personal
        data through the Site, and ask that you do not send it to us.
      </p>
      <p>
        <strong>Camera and video data is not collected through this Site.</strong>{" "}
        Any capture, ingestion or processing of camera footage or video applies
        only under the Overwatch Service and only in the hosted deployment model
        described in Section 3, governed by separate Product Terms, an Order and
        a Data Processing Agreement. Joining the waitlist does not involve any
        camera or video data.
      </p>

      <h2>5. How and why we use your information</h2>
      <table>
        <thead>
          <tr>
            <th>Purpose</th>
            <th>Lawful basis (UK/EU GDPR)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              To add you to the waitlist and contact you about the waitlist, the
              Overwatch launch, and related updates
            </td>
            <td>Consent</td>
          </tr>
          <tr>
            <td>
              To operate, maintain, secure and improve the Site, and prevent
              misuse or fraud
            </td>
            <td>Legitimate interests</td>
          </tr>
          <tr>
            <td>To respond to your enquiries and communications</td>
            <td>Legitimate interests</td>
          </tr>
          <tr>
            <td>
              To comply with legal, regulatory and accounting obligations
            </td>
            <td>Legal obligation</td>
          </tr>
        </tbody>
      </table>
      <p>
        Where we rely on <strong>consent</strong> (for example, waitlist and
        marketing emails), you can withdraw it at any time — every marketing
        email includes an <strong>unsubscribe</strong> link, and you can also
        contact us. Withdrawing consent does not affect processing carried out
        before withdrawal.
      </p>
      <p>
        Where we rely on <strong>legitimate interests</strong>, we have
        considered these against your rights and interests (for example, our
        interest in running a secure, functioning website and gauging interest
        in Overwatch).
      </p>
      <p>
        <strong>We do not sell your personal information</strong>, and we do not
        use it for invasive cross-site advertising or ad-tracking.
      </p>

      <h2>6. Cookies and analytics</h2>
      <p>The Site uses a limited number of cookies and similar technologies:</p>
      <ul>
        <li>
          <strong>Essential</strong> cookies/technologies needed for the Site to
          function and to keep it secure.
        </li>
        <li>
          <strong>Analytics</strong> in a privacy-respecting manner to
          understand aggregate usage (for example, how many people visit and
          which pages are popular), so we can improve the Site.
        </li>
      </ul>
      <p>
        We do not use invasive advertising or cross-site tracking cookies. Where
        required by law, we will request your consent for non-essential cookies,
        and you can control cookies through your browser settings.
      </p>

      <h2>7. Sharing and disclosure</h2>
      <p>
        We share personal information only as needed and with appropriate
        safeguards:
      </p>
      <ul>
        <li>
          <strong>Service providers / processors acting on our behalf</strong>,
          including hosting and website deployment providers and email delivery
          / CRM providers used to operate the Site and manage the waitlist.
          These providers process data on our instructions under appropriate
          contractual terms.
        </li>
        <li>
          <strong>
            Third-party AI providers (sub-processors) — Overwatch hosted product
            only.
          </strong>{" "}
          If and when a Customer uses the hosted Overwatch product, relevant
          video, frames or derived data may be forwarded to third-party
          artificial-intelligence providers acting as sub-processors to perform
          incident detection and scene understanding. These providers are{" "}
          <strong>
            contractually restricted from using the data to train or improve
            their own models
          </strong>{" "}
          and may process it <strong>only</strong> to provide the service back
          to Cradle Labs under its instructions. This does not apply to this
          Site or to waitlist data, and is governed by the Product Terms, Order
          and Data Processing Agreement described in Section 3.
        </li>
        <li>
          <strong>Legal and regulatory</strong> disclosures, where required by
          law, court order, or to establish, exercise or defend legal claims, or
          to protect the rights, safety and security of Cradle Labs, our users
          or the public.
        </li>
        <li>
          <strong>Business transfers</strong>, if Cradle Labs is involved in a
          merger, acquisition, financing or sale of assets, in which case
          personal information may be transferred subject to this Policy.
        </li>
      </ul>
      <p>
        <strong>We do not sell your personal information</strong> and we do not
        share it with third parties for their own independent marketing.
      </p>

      <h2>8. International transfers</h2>
      <p>
        Our service providers may process personal information in countries
        outside your own, including outside the UK/EEA. Where personal
        information is transferred internationally, we take steps to ensure an
        appropriate level of protection through recognised safeguards, such as
        adequacy decisions or standard contractual clauses (or equivalent
        mechanisms).
      </p>
      <p>
        For the Overwatch hosted product (see Section 3), where camera or video
        data or related personal data is transferred outside the UK or EEA —
        including to third-party AI sub-processors — Cradle Labs will put in
        place appropriate transfer safeguards, such as an adequacy decision, the
        UK International Data Transfer Agreement (IDTA) or UK Addendum, or EU
        Standard Contractual Clauses (or equivalent mechanisms), as set out in
        the applicable Data Processing Agreement. No such transfers arise from
        this Site or from joining the waitlist.
      </p>

      <h2>9. Data retention</h2>
      <p>
        We keep waitlist information for{" "}
        <strong>as long as needed for the waitlist and related communications</strong>
        , and then delete or anonymise it, unless we are required to keep it
        longer to comply with legal obligations or to resolve disputes.
        Technical and analytics data is retained only for as long as reasonably
        necessary for the purposes described above.
      </p>
      <p>
        Retention of camera footage, clips and related data under the Overwatch
        hosted product (see Section 3) is governed by the applicable Product
        Terms and Data Processing Agreement, which provide for{" "}
        <strong>limited retention</strong> and for the{" "}
        <strong>deletion or return of Customer footage on termination</strong>{" "}
        of the service. No such footage is held by Cradle Labs as a result of
        this Site or the waitlist.
      </p>

      <h2>10. Security</h2>
      <p>
        We use appropriate technical and organisational measures designed to
        protect personal information against unauthorised access, loss, misuse
        or alteration. No method of transmission or storage is completely
        secure, so we cannot guarantee absolute security, but we work to protect
        your information and to address any incident appropriately.
      </p>
      <p>
        For the Overwatch hosted product, the technical and organisational
        measures applicable to footage are specified in the Data Processing
        Agreement, and we will notify the Customer of personal data breaches
        affecting footage without undue delay, as set out in that agreement.
      </p>

      <h2>11. Your rights</h2>
      <p>Subject to applicable law, you may have the right to:</p>
      <ul>
        <li>
          <strong>access</strong> the personal information we hold about you;
        </li>
        <li>
          request <strong>rectification</strong> of inaccurate or incomplete
          information;
        </li>
        <li>
          request <strong>erasure</strong> of your personal information;
        </li>
        <li>
          <strong>object to</strong> or request <strong>restriction of</strong>{" "}
          our processing;
        </li>
        <li>
          request <strong>data portability</strong> (receive certain data in a
          portable format);
        </li>
        <li>
          <strong>withdraw consent</strong> at any time where processing is
          based on consent; and
        </li>
        <li>
          <strong>unsubscribe</strong> from marketing communications at any
          time.
        </li>
      </ul>
      <p>
        To exercise any of these rights, contact us using the details below. We
        may need to verify your identity. We will respond within the timeframes
        required by applicable law.
      </p>
      <p>
        You also have the right to{" "}
        <strong>lodge a complaint with a supervisory authority</strong> — in the
        UK, the Information Commissioner&apos;s Office (ICO) at ico.org.uk — or
        your local data protection authority. We would, however, appreciate the
        chance to address your concerns first.
      </p>

      <h2>12. Children</h2>
      <p>
        The Site is <strong>not directed to children under 16</strong>, and we
        do not knowingly collect personal information from anyone under 16. If
        you believe a child has provided us with personal information, please
        contact us and we will take reasonable steps to delete it.
      </p>

      <h2>13. Changes to this Policy</h2>
      <p>
        We may update this Policy from time to time. When we do, we will revise
        the &quot;Last updated&quot; date above and, where appropriate, take
        reasonable steps to notify you. Please review this Policy periodically.
      </p>

      <h2>14. Contact us</h2>
      <p>
        For any questions, requests, or to exercise your rights, please contact
        Cradle Labs Limited at:
      </p>
      <p>
        <strong>Email:</strong>{" "}
        <a href="mailto:hello@dterminal.net">hello@dterminal.net</a>
      </p>
      <p>
        This Policy, and any dispute or claim arising out of or in connection
        with it or its subject matter, shall be governed by and construed in
        accordance with the laws of the jurisdiction in which Cradle Labs
        Limited is incorporated, without prejudice to any mandatory data
        protection rights available to you under the law of your country of
        residence.
      </p>
    </LegalPage>
  );
}
