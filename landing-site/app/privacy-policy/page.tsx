import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy — Overwatch",
  description:
    "How Cradle Labs Limited handles personal information for Overwatch enquiries, site surveys and customers, and how Overwatch systems process camera footage.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="3 November 2026">
      <h2>1. Who we are</h2>
      <p>
        <strong>Cradle Labs Limited</strong> (&quot;Cradle Labs&quot;,
        &quot;we&quot;, &quot;us&quot;, &quot;our&quot;) designs, installs,
        provisions and supports Overwatch security systems. This Privacy Policy
        explains how we handle personal information when you visit this
        website (the &quot;Site&quot;), make an enquiry, book a site survey or
        become a customer, and how Overwatch systems that we install process
        camera footage.
      </p>
      <p>
        <strong>Contact:</strong>{" "}
        <a href="mailto:hello@dterminal.net">hello@dterminal.net</a>
      </p>

      <h2>2. Our two roles</h2>
      <ul>
        <li>
          <strong>Controller.</strong> We are the controller of the personal
          information we collect for our own business: Site visitors,
          enquiries, site surveys, quotations, customer accounts, billing and
          our correspondence with you. Sections 3 to 5 cover this.
        </li>
        <li>
          <strong>Processor.</strong> Each customer is the controller of the
          footage and data its Overwatch system captures. Where we handle that
          data, for example during installation, tuning, remote support or
          managed care, we act as the customer&apos;s processor under a{" "}
          <a href="/dpa">Data Processing Agreement</a> (DPA). Section 6
          explains how this works. If you have been recorded by an Overwatch
          system, see Section 6.6.
        </li>
      </ul>

      <h2>3. Information we collect</h2>
      <ul>
        <li>
          <strong>Enquiry and survey requests:</strong> your name, phone or
          WhatsApp number, email address, property type, approximate number of
          cameras, site location, the services you are interested in, and
          anything else you choose to tell us.
        </li>
        <li>
          <strong>Site survey information:</strong> notes, measurements and
          photographs of the property taken during a survey, and details of
          existing cameras and network equipment. We take reasonable care to
          avoid photographing people.
        </li>
        <li>
          <strong>Customer information:</strong> names and contact details of
          the customer&apos;s representatives and of operators and alert
          recipients the customer nominates (including phone numbers and
          Telegram identifiers used for alerts), contract, billing and payment
          records, and support history.
        </li>
        <li>
          <strong>Communications:</strong> emails, messages and call notes
          between you and us.
        </li>
        <li>
          <strong>Technical data:</strong> IP address, browser and device type,
          and pages visited, collected through server logs and
          privacy-respecting analytics.
        </li>
      </ul>
      <p>
        Please do not send us special-category information (for example,
        health information) through the Site.
      </p>

      <h2>4. How we use it</h2>
      <table>
        <thead>
          <tr>
            <th>Purpose</th>
            <th>Lawful basis (UK/EU GDPR)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Responding to your enquiry and arranging a site survey</td>
            <td>Steps at your request before a contract; legitimate interests</td>
          </tr>
          <tr>
            <td>Preparing your design and quotation</td>
            <td>Steps at your request before a contract</td>
          </tr>
          <tr>
            <td>
              Delivering installation, provisioning, support and managed care,
              and administering your account and invoices
            </td>
            <td>Performance of a contract</td>
          </tr>
          <tr>
            <td>Service and safety notices about your system</td>
            <td>Performance of a contract; legitimate interests</td>
          </tr>
          <tr>
            <td>News and offers about our services</td>
            <td>Consent, which you can withdraw at any time</td>
          </tr>
          <tr>
            <td>Operating and securing the Site, and preventing misuse</td>
            <td>Legitimate interests</td>
          </tr>
          <tr>
            <td>Accounting, tax and other legal obligations</td>
            <td>Legal obligation</td>
          </tr>
        </tbody>
      </table>
      <p>
        <strong>We do not sell personal information</strong>, and we do not use
        it for cross-site advertising.
      </p>

      <h2>5. Sharing</h2>
      <ul>
        <li>
          <strong>Service providers</strong> who help us run our business, such
          as website hosting, email, CRM, scheduling, accounting and payment
          providers, acting on our instructions.
        </li>
        <li>
          <strong>Installation partners and equipment suppliers</strong>, where
          needed to deliver an agreed installation, under confidentiality
          obligations.
        </li>
        <li>
          <strong>Professional advisers, authorities and courts</strong>, where
          required by law or to establish, exercise or defend legal claims.
        </li>
        <li>
          <strong>A buyer or successor</strong> of our business, subject to
          this Policy.
        </li>
      </ul>

      <h2>6. Overwatch systems and camera footage</h2>
      <p>
        This section describes the standard Overwatch architecture. The exact
        configuration for each site is recorded in the customer&apos;s Service
        Agreement and DPA.
      </p>
      <h3>6.1 Recording stays on-site</h3>
      <p>
        Cameras, recording, object detection and storage run on a server
        installed at the customer&apos;s premises. Continuous recordings,
        clips and frames are stored on that server, are not uploaded to Cradle
        Labs, and are kept for the retention periods the customer sets.
      </p>
      <h3>6.2 AI analysis</h3>
      <p>
        In the standard configuration, when an incident is opened, a short
        clip and selected still frames are sent to a third-party AI vision
        service to produce a plain-language summary and to verify critical
        events such as fire. When an authorised user messages the
        conversational assistant, the message and the relevant incident and
        camera information are processed by a third-party AI language-model
        service. Continuous recordings are not sent to these services. We
        configure these services so that customer data is not used to train
        the provider&apos;s models, and we list the providers we use in the
        DPA sub-processor list, which is available on request.
      </p>
      <p>
        Where the customer chooses the <strong>local AI configuration</strong>,
        incident analysis runs on the customer&apos;s own server and no video
        is sent to a cloud AI service.
      </p>
      <h3>6.3 Messaging platforms</h3>
      <p>
        Alerts, clips, poster frames and assistant replies are delivered to
        the recipients the customer nominates through WhatsApp (operated by
        Meta) and/or Telegram. Those platforms process message content under
        their own terms and privacy policies. Playback links in alerts are
        cryptographically signed and expire automatically.
      </p>
      <h3>6.4 Our access</h3>
      <p>
        We access a customer&apos;s system and footage only as needed to
        install, commission, tune, support and maintain it. Access is limited
        to authorised personnel, bound by confidentiality, and carried out on
        the customer&apos;s instructions under the DPA.
      </p>
      <h3>6.5 Automated decisions</h3>
      <p>
        Overwatch detects objects and events to help people respond. It does
        not identify individuals by face or make decisions that produce legal
        or similarly significant effects on anyone.
      </p>
      <h3>6.6 If you have been recorded</h3>
      <p>
        If you think you have been recorded by an Overwatch system and want to
        access footage of yourself or raise a concern, contact the operator of
        the property where the camera is located, as they are the controller.
        If you cannot identify or reach them, contact us and we will pass your
        request to the relevant customer.
      </p>

      <h2>7. Cookies and analytics</h2>
      <p>
        The Site uses essential technologies needed for it to work securely,
        and privacy-respecting analytics to understand aggregate usage. We do
        not use advertising or cross-site tracking cookies. Where the law
        requires consent for non-essential cookies, we will ask for it.
      </p>

      <h2>8. International transfers</h2>
      <p>
        Some of our service providers, and the AI and messaging providers
        described in Section 6, may process data outside your country,
        including outside the UK and EEA. Where this happens, we rely on
        recognised safeguards such as adequacy decisions or standard
        contractual clauses (including the UK Addendum or IDTA), as set out in
        the DPA for customer data.
      </p>

      <h2>9. How long we keep information</h2>
      <ul>
        <li>
          <strong>Enquiries that do not proceed:</strong> up to 24 months after
          our last contact, then deleted.
        </li>
        <li>
          <strong>Survey photographs and notes:</strong> deleted once the
          design and quotation are delivered and not accepted, or kept as part
          of the project file if you become a customer.
        </li>
        <li>
          <strong>Customer records:</strong> for the duration of the Service
          Agreement and afterwards for as long as required for legal,
          accounting and warranty purposes.
        </li>
        <li>
          <strong>Footage on customer systems:</strong> controlled by the
          customer&apos;s retention settings. Any copies we hold for support are
          deleted when the related task is complete, as set out in the DPA.
        </li>
      </ul>

      <h2>10. Security</h2>
      <p>
        We use appropriate technical and organisational measures to protect
        personal information, including access controls, encryption in transit
        and least-privilege access to customer systems. No system is
        completely secure, but we work to prevent incidents and to respond to
        them promptly, including notifying customers of personal data breaches
        affecting their data without undue delay.
      </p>

      <h2>11. Your rights</h2>
      <p>
        Depending on where you live, you may have the right to access,
        correct or delete your personal information, to object to or restrict
        how we use it, to data portability, and to withdraw consent at any
        time. To exercise these rights, contact us at the address below; we
        may need to verify your identity. You may also complain to a data
        protection authority, such as the UK Information Commissioner&apos;s
        Office (ico.org.uk), although we would appreciate the chance to
        resolve your concern first.
      </p>

      <h2>12. Children</h2>
      <p>
        The Site and our services are intended for adults and organisations.
        We do not knowingly collect personal information from children through
        the Site.
      </p>

      <h2>13. Changes to this Policy</h2>
      <p>
        We may update this Policy from time to time and will revise the
        &quot;Last updated&quot; date when we do. Where a change materially
        affects customers, we will tell them directly.
      </p>

      <h2>14. Contact</h2>
      <p>
        For questions or requests about this Policy, contact Cradle Labs
        Limited at{" "}
        <a href="mailto:hello@dterminal.net">hello@dterminal.net</a>.
      </p>
    </LegalPage>
  );
}
