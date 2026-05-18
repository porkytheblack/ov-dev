import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy — Overwatch",
  description:
    "Privacy Policy for the Overwatch waitlist and marketing website, operated by Cradle Labs Limited.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="[DATE]">
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
      <p className="callout">[Registered address — confirm]</p>
      <p className="callout">[Contact email: hello@ — confirm]</p>

      <h2>2. Scope</h2>
      <p>
        This Policy applies to the marketing Site and the waitlist signup only.
        Overwatch is not yet generally available, and the Site does not provide
        the product or a user account. Separate privacy terms will apply to the
        Overwatch product if and when it launches.
      </p>

      <h2>3. What we collect</h2>
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

      <h2>4. How and why we use your information</h2>
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

      <h2>5. Cookies and analytics</h2>
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

      <h2>6. Sharing and disclosure</h2>
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

      <h2>7. International transfers</h2>
      <p>
        Our service providers may process personal information in countries
        outside your own, including outside the UK/EEA. Where personal
        information is transferred internationally, we take steps to ensure an
        appropriate level of protection through recognised safeguards, such as
        adequacy decisions or standard contractual clauses (or equivalent
        mechanisms).
      </p>

      <h2>8. Data retention</h2>
      <p>
        We keep waitlist information for{" "}
        <strong>as long as needed for the waitlist and related communications</strong>
        , and then delete or anonymise it, unless we are required to keep it
        longer to comply with legal obligations or to resolve disputes.
        Technical and analytics data is retained only for as long as reasonably
        necessary for the purposes described above.
      </p>

      <h2>9. Security</h2>
      <p>
        We use appropriate technical and organisational measures designed to
        protect personal information against unauthorised access, loss, misuse
        or alteration. No method of transmission or storage is completely
        secure, so we cannot guarantee absolute security, but we work to protect
        your information and to address any incident appropriately.
      </p>

      <h2>10. Your rights</h2>
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

      <h2>11. Children</h2>
      <p>
        The Site is <strong>not directed to children under 16</strong>, and we
        do not knowingly collect personal information from anyone under 16. If
        you believe a child has provided us with personal information, please
        contact us and we will take reasonable steps to delete it.
      </p>

      <h2>12. Changes to this Policy</h2>
      <p>
        We may update this Policy from time to time. When we do, we will revise
        the &quot;Last updated&quot; date above and, where appropriate, take
        reasonable steps to notify you. Please review this Policy periodically.
      </p>

      <h2>13. Contact us</h2>
      <p>
        For any questions, requests, or to exercise your rights, please contact
        Cradle Labs Limited at:
      </p>
      <p className="callout">[Contact email: hello@ — confirm]</p>
      <p className="callout">[Registered address — confirm]</p>
      <p className="callout">[Governing law: England and Wales — confirm]</p>
    </LegalPage>
  );
}
