import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Data Processing Agreement — Overwatch",
  description:
    "Standard-form Data Processing Agreement for the hosted Overwatch service, operated by Cradle Labs Limited.",
};

export default function DpaPage() {
  return (
    <LegalPage title="Data Processing Agreement" updated="18 May 2026">
      <p>
        This Data Processing Agreement (the <strong>&quot;DPA&quot;</strong>) is
        entered into between <strong>Cradle Labs Limited</strong>
        (&quot;Cradle Labs&quot;, &quot;we&quot;, &quot;us&quot;,
        &quot;our&quot;) and the <strong>Customer</strong> identified in the
        applicable Order. It is the standard-form data processing agreement
        referenced by the Cradle Labs <a href="/terms">Terms of Service</a>{" "}
        (Section 4) and <a href="/privacy-policy">Privacy Policy</a> (Section
        3), and forms part of and is incorporated into the Product Terms and the
        applicable Order for the <strong>hosted / managed</strong> deployment
        model of the Overwatch Service. It applies only where Cradle Labs
        processes Customer Personal Data on the Customer&apos;s behalf in that
        hosted model, and does not apply to the marketing website, the
        waitlist, or the self-hosted / on-premises deployment model.
      </p>

      <h2>1. Definitions and interpretation</h2>
      <p>
        <strong>1.1 Defined terms.</strong> In this DPA:
      </p>
      <ul>
        <li>
          <strong>&quot;Cradle Labs Limited&quot;</strong>,{" "}
          <strong>&quot;Customer&quot;</strong>,{" "}
          <strong>&quot;Overwatch Service&quot;</strong>,{" "}
          <strong>&quot;Product Terms&quot;</strong> and{" "}
          <strong>&quot;Order&quot;</strong> have the meanings given in the
          Cradle Labs Terms of Service (Section 4) and are used consistently
          with that document and the Privacy Policy (Section 3).
        </li>
        <li>
          <strong>&quot;controller&quot;</strong>,{" "}
          <strong>&quot;processor&quot;</strong>,{" "}
          <strong>&quot;data subject&quot;</strong>,{" "}
          <strong>&quot;personal data&quot;</strong>,{" "}
          <strong>&quot;processing&quot;</strong>,{" "}
          <strong>&quot;personal data breach&quot;</strong> and{" "}
          <strong>&quot;special category data&quot;</strong> have the meanings
          given in the Data Protection Laws.
        </li>
        <li>
          <strong>&quot;Data Protection Laws&quot;</strong> means all laws and
          regulations applicable to the processing of personal data under this
          DPA, including, to the extent applicable: (a) the UK GDPR (the
          retained EU General Data Protection Regulation as it forms part of the
          law of the United Kingdom); (b) the EU General Data Protection
          Regulation (Regulation (EU) 2016/679) (the{" "}
          <strong>&quot;EU GDPR&quot;</strong>); (c) the UK Data Protection Act
          2018; (d) the Privacy and Electronic Communications Regulations and
          equivalent rules where relevant; and (e) any other applicable data
          protection or privacy law, including any applicable United States
          state privacy law under which Cradle Labs acts as a &quot;service
          provider&quot;, &quot;processor&quot; or &quot;contractor&quot;
          (including the California Consumer Privacy Act as amended (the{" "}
          <strong>&quot;CCPA&quot;</strong>)), in each case as amended,
          superseded or replaced.
        </li>
        <li>
          <strong>&quot;Customer Personal Data&quot;</strong> means personal
          data that Cradle Labs processes on behalf of the Customer under the
          Product Terms, the Order and this DPA in connection with the hosted
          Overwatch Service, as further described in Annex 1. It includes{" "}
          <strong>&quot;Footage&quot;</strong>, meaning the camera video and
          image data (and any audio enabled by the Customer) ingested,
          transmitted, processed or stored through the hosted Overwatch
          Service, together with associated frames, timestamps, metadata and
          AI-derived detections and analytics relating to identified or
          identifiable individuals.
        </li>
        <li>
          <strong>&quot;Sub-processor&quot;</strong> means any third party
          engaged by Cradle Labs (or by another Sub-processor) to process
          Customer Personal Data in connection with the hosted Overwatch
          Service.
        </li>
        <li>
          <strong>&quot;Security Incident&quot;</strong> means a personal data
          breach affecting Customer Personal Data, that is, a breach of security
          leading to the accidental or unlawful destruction, loss, alteration,
          unauthorised disclosure of, or access to, Customer Personal Data
          processed by Cradle Labs or a Sub-processor.
        </li>
        <li>
          <strong>&quot;Standard Contractual Clauses&quot;</strong> or{" "}
          <strong>&quot;SCCs&quot;</strong> means: (a) the standard contractual
          clauses for the transfer of personal data to third countries adopted
          by the European Commission under the EU GDPR (Commission Implementing
          Decision (EU) 2021/914), the <strong>&quot;EU SCCs&quot;</strong>; and
          (b) for transfers subject to UK law, the International Data Transfer
          Agreement and/or the International Data Transfer Addendum to the EU
          SCCs issued by the UK Information Commissioner (together, the{" "}
          <strong>&quot;UK Addendum/IDTA&quot;</strong>), in each case as amended
          or replaced.
        </li>
        <li>
          <strong>&quot;Restricted Transfer&quot;</strong> means a transfer
          (including onward transfer) of Customer Personal Data that is subject
          to the cross-border transfer restrictions of the Data Protection
          Laws.
        </li>
      </ul>
      <p>
        <strong>1.2 Interpretation.</strong> References to Articles are to
        Articles of the UK GDPR and/or EU GDPR as applicable. The Annexes form
        part of this DPA. Headings are for convenience only. Capitalised terms
        used but not defined in this DPA have the meanings given in the Product
        Terms.
      </p>
      <p>
        <strong>1.3 Order of precedence.</strong> In the event of any conflict
        or inconsistency, the following order of precedence applies, in
        descending order: (a) the Standard Contractual Clauses, but only in
        respect of Restricted Transfers and only to the extent of the conflict;
        (b) this DPA; (c) the Product Terms; and (d) the Order, except that the
        Order prevails to the extent it records particulars this DPA expressly
        states are completed in the Order. This DPA prevails over the Product
        Terms on all data protection matters.
      </p>

      <h2>2. Scope, roles and relationship of the parties</h2>
      <p>
        <strong>2.1 Roles.</strong> As between the parties and in respect of
        Customer Personal Data, the <strong>Customer is the controller</strong>{" "}
        and <strong>Cradle Labs is the processor</strong>. Where another
        controller&apos;s personal data is included in Customer Personal Data,
        the Customer warrants it is authorised to act for and instruct on behalf
        of that controller, and Cradle Labs may treat the Customer as the sole
        point of contact.
      </p>
      <p>
        <strong>2.2 Ancillary independent-controller carve-out.</strong> Cradle
        Labs acts as an independent controller only for limited ancillary
        purposes, namely securing and ensuring the integrity and availability of
        the Overwatch Service, preventing and investigating misuse, fraud and
        abuse, billing and account administration, maintaining service logs and
        records, and compliance with Cradle Labs&apos; own legal obligations and
        the establishment, exercise or defence of legal claims. Such ancillary
        processing is conducted in accordance with the Privacy Policy and
        applicable Data Protection Laws and is not governed by Clauses 3 to 14
        and 16 of this DPA, which apply to Cradle Labs as processor.
      </p>
      <p>
        <strong>2.3 Duration.</strong> This DPA applies for as long as Cradle
        Labs processes Customer Personal Data, which corresponds to the duration
        of the Customer&apos;s use of the hosted Overwatch Service under the
        Product Terms and the Order, subject to the survival provisions in
        Clause 17.
      </p>
      <p>
        <strong>2.4 Ownership and no sale.</strong> As between the parties, the
        Customer retains all right, title and interest in and to the Footage and
        Customer Personal Data, and Cradle Labs obtains no ownership rights in
        it. Cradle Labs <strong>does not sell or share</strong> Customer
        Personal Data (as &quot;sell&quot; and &quot;share&quot; are defined
        under applicable US state privacy law), does not process it for
        cross-context behavioural advertising, and does not retain, use or
        disclose it outside the direct business purpose of providing the
        Overwatch Service to the Customer or as otherwise permitted or required
        by the Data Protection Laws. Cradle Labs does not combine Customer
        Personal Data with personal data from other sources except as permitted
        by the Data Protection Laws. Where Cradle Labs acts as a &quot;service
        provider&quot;, &quot;processor&quot; or &quot;contractor&quot; under US
        state privacy law, it gives the Customer the same level of privacy
        protection as required of such a recipient and certifies that it
        understands and will comply with the restrictions in this Clause 2.4.
      </p>

      <h2>3. Processing only on documented instructions</h2>
      <p>
        <strong>3.1 Documented instructions.</strong> Cradle Labs processes
        Customer Personal Data only on the Customer&apos;s documented
        instructions, including with regard to Restricted Transfers, unless
        required to process by applicable law. The Customer&apos;s documented
        instructions are constituted by the Product Terms, the Order, this DPA,
        and the Customer&apos;s documented configuration of and use of the
        Overwatch Service (including features, retention settings, integrations
        and any optional capabilities the Customer enables). Additional or
        alternative instructions must be agreed in writing and may be subject to
        adjustment of fees or scope under the Product Terms.
      </p>
      <p>
        <strong>3.2 Lawful-instruction notice.</strong> Cradle Labs informs the
        Customer if, in its opinion, an instruction infringes the Data
        Protection Laws, but is not obliged to provide legal advice and is not
        responsible for monitoring the Customer&apos;s compliance with laws
        applicable to the Customer&apos;s surveillance activities.
      </p>
      <p>
        <strong>3.3 Legally required processing.</strong> If applicable law
        requires Cradle Labs to process Customer Personal Data otherwise than on
        the Customer&apos;s instructions, Cradle Labs informs the Customer of
        that legal requirement before processing, unless that law prohibits such
        notification on important grounds of public interest.
      </p>

      <h2>4. Customer obligations and warranties</h2>
      <p>
        <strong>4.1</strong> The Customer warrants and undertakes that:
      </p>
      <ul>
        <li>
          (a) it has and will maintain, throughout the term, a valid lawful
          basis under the Data Protection Laws for the camera surveillance it
          conducts and for instructing Cradle Labs and its Sub-processors to
          capture, ingest, transmit, process, store and forward the Footage as
          contemplated by the Overwatch Service;
        </li>
        <li>
          (b) it has provided and will maintain all signage, notices,
          transparency information and other communications to data subjects,
          and has obtained and will maintain any consents or authorisations,
          required by the Data Protection Laws (including any applicable CCTV or
          video-surveillance codes of practice and regulatory guidance, such as
          the ICO video surveillance guidance and the Surveillance Camera Code
          of Practice where applicable) in respect of the recording and
          processing of individuals captured by its cameras;
        </li>
        <li>
          (c) where its configuration of the Overwatch Service involves special
          category data or biometric data (including any facial recognition
          functionality it enables), it is solely responsible for identifying
          and maintaining a valid Article 9 condition, for any
          appropriate-policy document, and for carrying out any data protection
          impact assessment and prior consultation required by Articles 35 and
          36;
        </li>
        <li>
          (d) its instructions (including its configuration) are accurate,
          lawful and within its authority, and complying with them will not
          cause Cradle Labs or any Sub-processor to breach the Data Protection
          Laws; and
        </li>
        <li>
          (e) it will not use the Overwatch Service, or instruct Cradle Labs, in
          any manner that is unlawful, covert (other than as lawfully
          permitted), harassing or discriminatory, and it will not require
          Cradle Labs to process Customer Personal Data unlawfully.
        </li>
      </ul>
      <p>
        <strong>4.2</strong> The allocation of responsibility in this Clause 4
        is consistent with Section 4 of the Terms of Service and Section 3 of
        the Privacy Policy: the Customer carries responsibility for the
        lawfulness of the surveillance, and Cradle Labs carries the
        processor-side security and Sub-processor responsibilities set out in
        this DPA.
      </p>

      <h2>5. Confidentiality</h2>
      <p>
        <strong>5.1</strong> Cradle Labs ensures that persons authorised to
        process Customer Personal Data are subject to an appropriate duty of
        confidentiality (whether contractual or statutory), are made aware of
        the confidential nature of the Customer Personal Data, and access
        Customer Personal Data only on a need-to-know basis to the extent
        necessary to provide, secure, maintain and support the Overwatch
        Service or to comply with applicable law. These obligations survive
        termination.
      </p>

      <h2>6. Security</h2>
      <p>
        <strong>6.1 Technical and organisational measures.</strong> Taking into
        account the state of the art, the costs of implementation, and the
        nature, scope, context and purposes of processing, as well as the risks
        of varying likelihood and severity for the rights and freedoms of data
        subjects, Cradle Labs implements and maintains appropriate technical and
        organisational measures to ensure a level of security appropriate to the
        risk, in accordance with Article 32. Those measures are described in{" "}
        <strong>Annex 2</strong> and reflect the elevated risk associated with
        high-volume video Footage.
      </p>
      <p>
        <strong>6.2 Maintenance and review.</strong> Cradle Labs reviews and,
        where appropriate, updates its security measures. Measures may be
        updated to reflect evolving risks, technology and practice but will not
        be materially weakened below the standard described in Annex 2 for
        active processing.
      </p>

      <h2>7. Sub-processing</h2>
      <p>
        <strong>7.1 General authorisation.</strong> The Customer grants Cradle
        Labs a <strong>general written authorisation</strong> to engage
        Sub-processors to process Customer Personal Data, subject to this Clause
        7. The current categories of Sub-processors are set out in{" "}
        <strong>Annex 3</strong>.
      </p>
      <p>
        <strong>7.2 Prior notice and objection.</strong> Cradle Labs gives the
        Customer prior notice of the intended addition or replacement of a
        Sub-processor (including by the means described in Annex 3, which may
        include the contact address below or a maintained list), thereby giving
        the Customer the opportunity to <strong>reasonably object</strong> on
        reasonable, data-protection grounds before the new Sub-processor begins
        processing Customer Personal Data. The parties will work in good faith
        to resolve any such objection. If the objection cannot reasonably be
        resolved, the Customer may, as its sole and exclusive remedy, terminate
        the affected part of the Overwatch Service in accordance with the
        Product Terms.
      </p>
      <p>
        <strong>7.3 Flow-down.</strong> Cradle Labs imposes on each
        Sub-processor, by a written contract, data protection obligations that
        are in substance equivalent to and no less protective than those in this
        DPA, in particular obligations to implement appropriate technical and
        organisational measures and to process the data only as necessary to
        provide the relevant functionality to Cradle Labs.
      </p>
      <p>
        <strong>7.4 AI-provider restriction.</strong> Without limiting Clause
        7.3, every Sub-processor that is a third-party artificial-intelligence
        or machine-learning provider is contractually restricted from using
        Customer Personal Data (including Footage, frames or derived data) to
        train, fine-tune, develop or improve its own or any third party&apos;s
        models, products or services, and may process such data{" "}
        <strong>only</strong> to provide the detection and scene-understanding
        functionality back to Cradle Labs in accordance with Cradle Labs&apos;
        instructions and for no other purpose. This restatement is also set out
        in Annex 3 and Clause 16.
      </p>
      <p>
        <strong>7.5 Continuing liability.</strong> Cradle Labs remains fully
        liable to the Customer for the performance of each Sub-processor&apos;s
        data protection obligations to the same extent Cradle Labs would be
        liable if performing those obligations itself.
      </p>

      <h2>8. Assistance to the Customer</h2>
      <p>
        <strong>8.1 Data-subject rights.</strong> Taking into account the nature
        of the processing, Cradle Labs assists the Customer by appropriate
        technical and organisational measures, insofar as possible, in
        fulfilling the Customer&apos;s obligations to respond to requests by
        data subjects to exercise their rights under Articles 12 to 23
        (including access, rectification, erasure, restriction, portability and
        objection). Where Cradle Labs receives such a request directly, Clause
        10 applies.
      </p>
      <p>
        <strong>8.2 Articles 32–36 assistance.</strong> Taking into account the
        nature of processing and the information available to Cradle Labs,
        Cradle Labs assists the Customer in ensuring compliance with the
        Customer&apos;s obligations under Articles 32 to 36, namely security of
        processing, notification and communication of personal data breaches,
        data protection impact assessments, and prior consultation with the
        supervisory authority.
      </p>
      <p>
        <strong>8.3 Reasonable assistance.</strong> Assistance under this Clause
        8 that is materially burdensome or exceeds what is required by the Data
        Protection Laws may be provided on reasonable terms (including
        reimbursement of reasonable costs) as agreed under the Product Terms.
      </p>

      <h2>9. Personal data breach / Security Incident</h2>
      <p>
        <strong>9.1 Notification.</strong> Cradle Labs notifies the Customer{" "}
        <strong>without undue delay</strong> after becoming aware of a Security
        Incident.
      </p>
      <p>
        <strong>9.2 Information.</strong> The notification includes, to the
        extent then known and as it becomes available, a description of the
        nature of the Security Incident (including, where possible, the
        categories and approximate number of data subjects and records
        concerned), the likely consequences, the measures taken or proposed to
        address it and mitigate its adverse effects, and a contact point for
        further information.
      </p>
      <p>
        <strong>9.3 Remediation and cooperation.</strong> Cradle Labs takes
        reasonable steps to investigate, contain and remediate the Security
        Incident and cooperates reasonably with the Customer, including to
        enable the Customer to meet its own notification obligations to
        supervisory authorities and data subjects, which remain the
        Customer&apos;s responsibility as controller.
      </p>
      <p>
        <strong>9.4 No admission.</strong> Notification of, or response to, a
        Security Incident is not and must not be construed as an acknowledgement
        or admission by Cradle Labs of any fault or liability. Subject to
        applicable law, neither party makes any public statement attributing
        fault to the other in respect of a Security Incident without prior
        consultation, save as required by law or regulators.
      </p>

      <h2>10. Data-subject and third-party requests received by Cradle Labs</h2>
      <p>
        <strong>10.1</strong> If Cradle Labs (or a Sub-processor) receives a
        request or communication from a data subject, supervisory authority or
        other third party that relates to Customer Personal Data, Cradle Labs
        does not respond to it other than to acknowledge receipt and/or to
        redirect the requester to the Customer, unless and to the extent the
        Customer instructs Cradle Labs in writing to respond or Cradle Labs is
        legally required to respond. Cradle Labs informs the Customer of the
        request without undue delay and assists the Customer as set out in
        Clause 8.
      </p>
      <p>
        <strong>10.2 Law-enforcement and governmental requests.</strong> Where
        the request is from a law-enforcement or governmental body, Cradle Labs
        discloses only the minimum Customer Personal Data legally required, and,
        where legally permitted, notifies the Customer before disclosure (or as
        soon as legally permitted afterwards) and uses reasonable efforts to
        redirect the requester to the Customer and to challenge requests that
        are, in Cradle Labs&apos; reasonable assessment, overbroad, invalid or
        unlawful.
      </p>

      <h2>11. International transfers</h2>
      <p>
        <strong>11.1 Incorporation of transfer mechanisms.</strong> To the
        extent any processing under this DPA involves a Restricted Transfer, the
        Standard Contractual Clauses are{" "}
        <strong>incorporated into this DPA by reference</strong> and are entered
        into between the relevant data exporter and data importer. The
        applicable module and role selections are set out in{" "}
        <strong>Annex 4</strong>.
      </p>
      <p>
        <strong>11.2 UK transfers.</strong> For Restricted Transfers subject to
        UK law, the <strong>UK Addendum/IDTA</strong> applies and is
        incorporated by reference, amending and supplementing the EU SCCs as
        required to provide an appropriate level of protection under UK Data
        Protection Laws.
      </p>
      <p>
        <strong>11.3 Onward transfers to Sub-processors.</strong> Where Cradle
        Labs engages a Sub-processor outside the territory of origin, Cradle
        Labs ensures an appropriate transfer mechanism is in place (including
        the relevant module of the Standard Contractual Clauses or another
        lawful mechanism) before the Restricted Transfer occurs.
      </p>
      <p>
        <strong>11.4 Transfer impact and supplementary measures.</strong> Each
        party agrees to cooperate in any required transfer impact assessment.
        Cradle Labs applies appropriate supplementary technical, organisational
        and contractual measures (consistent with Annex 2) where necessary to
        ensure that transferred Customer Personal Data receives a level of
        protection essentially equivalent to that required by the Data
        Protection Laws.
      </p>
      <p>
        <strong>11.5 Conflict.</strong> In the event of any conflict between the
        Standard Contractual Clauses and this DPA or the Product Terms, the
        Standard Contractual Clauses prevail in respect of Restricted Transfers
        and only to the extent of the conflict (consistent with Clause 1.3).
      </p>

      <h2>12. Audits and information</h2>
      <p>
        <strong>12.1 Information.</strong> Cradle Labs makes available to the
        Customer the information reasonably necessary to demonstrate compliance
        with Article 28 and this DPA.
      </p>
      <p>
        <strong>12.2 Audits.</strong> Cradle Labs allows for and contributes to
        audits, including inspections, conducted by the Customer or an
        independent auditor mandated by the Customer (and reasonably acceptable
        to Cradle Labs and not a competitor of Cradle Labs), in relation to the
        processing of Customer Personal Data. Such audits are subject to
        reasonable safeguards: reasonable prior written notice; conduct during
        business hours; no more than once in any twelve-month period (save where
        required by a supervisory authority or following a Security Incident
        materially affecting the Customer&apos;s Customer Personal Data); a
        scope that does not require disclosure of other customers&apos; data, or
        information that would compromise security, confidentiality or legal
        privilege; appropriate confidentiality undertakings; and bearing of each
        party&apos;s own costs (the Customer bearing the reasonable costs of
        audits it initiates, save where the audit reveals material
        non-compliance by Cradle Labs).
      </p>
      <p>
        <strong>12.3 Reports and certifications.</strong> Cradle Labs may
        satisfy audit and information requests, where reasonable, by providing
        relevant third-party audit reports, attestations or recognised
        certifications (such as ISO/IEC 27001 certification or SOC 2 type
        reports, where held), and the Customer agrees to accept such materials
        in lieu of an on-site audit where they reasonably address the matters in
        question.
      </p>

      <h2>13. Deletion or return</h2>
      <p>
        <strong>13.1</strong> On expiry or termination of the hosted Overwatch
        Service (or, in respect of a defined data set, upon the Customer&apos;s
        written request), Cradle Labs, at the Customer&apos;s choice, deletes or
        returns all Customer Personal Data and Footage to the Customer, and
        deletes existing copies, within a reasonable period not exceeding the
        period stated in the Product Terms or Order or, absent a stated period,
        ninety (90) days, save to the extent applicable law requires Cradle Labs
        to retain some or all of the Customer Personal Data, in which case
        Cradle Labs continues to protect it and processes it only as required by
        that law.
      </p>
      <p>
        <strong>13.2</strong> Cradle Labs procures the deletion of Customer
        Personal Data held by Sub-processors on the same basis.
      </p>
      <p>
        <strong>13.3</strong> On the Customer&apos;s written request, Cradle
        Labs provides written certification that it has complied with this
        Clause 13.
      </p>

      <h2>14. Records of processing</h2>
      <p>
        <strong>14.1</strong> Cradle Labs maintains a record of the categories
        of processing activities carried out on behalf of the Customer, in
        accordance with Article 30(2), and makes that record available to the
        supervisory authority or the Customer on reasonable request to the
        extent required by the Data Protection Laws.
      </p>

      <h2>15. Liability and indemnity</h2>
      <p>
        <strong>15.1 Single cap.</strong> Each party&apos;s liability arising
        out of or in connection with this DPA is subject to the exclusions,
        limitations and aggregate liability cap set out in the Product Terms.
        The Product Terms and this DPA are subject to a{" "}
        <strong>single, combined aggregate cap</strong>; the cap is not
        duplicated, multiplied or increased by the existence of this DPA, and
        liability under this DPA and the Product Terms is aggregated for the
        purpose of that cap.
      </p>
      <p>
        <strong>15.2 Non-excludable liability.</strong> Nothing in this DPA or
        the Product Terms excludes or limits any liability that cannot lawfully
        be excluded or limited.
      </p>
      <p>
        <strong>15.3 Allocation by role.</strong> Liability is allocated
        consistently with each party&apos;s role and responsibilities under this
        DPA: the Customer is responsible for the lawfulness of the surveillance
        and its instructions, and Cradle Labs is responsible for its processor
        obligations and Sub-processor management as set out in this DPA.
      </p>
      <p>
        <strong>15.4 Customer indemnity.</strong> The Customer indemnifies
        Cradle Labs against losses, damages, liabilities, fines and reasonable
        costs arising out of or in connection with the Customer&apos;s unlawful
        or unauthorised instructions, the Customer&apos;s lack of or
        insufficient lawful basis for the surveillance or processing, the
        Customer&apos;s failure to provide required notices or obtain required
        consents, or the Customer&apos;s breach of Clause 4, subject to any
        limitations in the Product Terms that apply to such indemnity.
      </p>

      <h2>16. AI processing schedule</h2>
      <p>
        <strong>16.1 Nature of AI processing.</strong> In the hosted Overwatch
        Service, Footage and derived data are processed (including by forwarding
        relevant video, frames or derived data to AI Sub-processors) to produce{" "}
        <strong>probabilistic, assistive</strong> incident detections and scene
        understanding. Such outputs are not guaranteed to be accurate, complete
        or timely and are intended only to assist the Customer, consistent with
        Section 4 of the Terms of Service.
      </p>
      <p>
        <strong>16.2 No training by Sub-processors.</strong> AI Sub-processors{" "}
        <strong>do not train, fine-tune, develop or improve</strong> their own
        or any third party&apos;s models on, and do not retain, Customer
        Personal Data beyond what is necessary to provide the functionality back
        to Cradle Labs, as further set out in Clause 7.4 and Annex 3.
      </p>
      <p>
        <strong>16.3 Cradle Labs&apos; position on model training.</strong>{" "}
        Cradle Labs does not use Footage or Customer Personal Data to train,
        fine-tune or improve its own or any third party&apos;s general models.
        Cradle Labs may use data that has been properly aggregated and/or
        anonymised such that it is no longer personal data, and only to the
        extent lawful, to operate, evaluate and improve the Overwatch Service.
        This position is stated conservatively and may be further specified, but
        not materially relaxed for active processing without notice under Clause
        17.
      </p>
      <p>
        <strong>16.4 Automated decision-making (Article 22).</strong> The
        Overwatch Service is not designed to make decisions producing legal or
        similarly significant effects on individuals. Any use of outputs to take
        decisions producing legal or similarly significant effects, including
        any solely automated decision-making within the meaning of Article 22,
        is the Customer&apos;s responsibility under its own lawful basis and
        Article 22 obligations and is not a designed function of the Overwatch
        Service.
      </p>
      <p>
        <strong>16.5 Data minimisation.</strong> Cradle Labs applies data
        minimisation to AI processing and to derived-data handling, processing
        and forwarding only such Footage and data as is reasonably necessary for
        detection and scene understanding, and handling derived detections and
        analytics consistently with this DPA and Annex 2.
      </p>

      <h2>17. Term, changes and survival</h2>
      <p>
        <strong>17.1 Term.</strong> This DPA takes effect on acceptance of the
        Order for the hosted Overwatch Service and continues for as long as
        Cradle Labs processes Customer Personal Data.
      </p>
      <p>
        <strong>17.2 Changes.</strong> Cradle Labs may update this standard-form
        DPA from time to time (for example, to reflect changes in law,
        regulatory guidance, Sub-processor categories or practice). Cradle Labs
        will not make changes that materially reduce the protections applicable
        to active processing without giving the Customer reasonable prior
        notice. Updates to mandatory transfer mechanisms required by law take
        effect as required by that law.
      </p>
      <p>
        <strong>17.3 Survival.</strong> Clauses 1, 2.4, 5, 9.4, 11.5, 13, 15,
        16.2, 16.3, 17 and 18, and any other provision which by its nature
        should survive, survive termination or expiry of this DPA.
      </p>

      <h2>18. General</h2>
      <p>
        <strong>18.1 Notices.</strong> Notices to Cradle Labs under this DPA are
        sent to{" "}
        <a href="mailto:hello@dterminal.net">hello@dterminal.net</a>. Notices to
        the Customer are sent to the contact and notice details set out in the
        applicable Order. Operational notices (including Sub-processor change
        notices under Clause 7.2) may be given by the means described in Annex
        3.
      </p>
      <p>
        <strong>18.2 Entire agreement on processing.</strong> This DPA, together
        with the Product Terms and the Order, constitutes the entire agreement
        between the parties regarding the processing of Customer Personal Data
        and supersedes any prior data processing terms on that subject matter.
      </p>
      <p>
        <strong>18.3 Severability.</strong> If any provision of this DPA is held
        invalid or unenforceable, the remaining provisions continue in full
        force, and the invalid provision is replaced by a valid provision that
        most closely reflects the parties&apos; intention.
      </p>
      <p>
        <strong>18.4 No third-party rights.</strong> A person who is not a party
        to this DPA has no right to enforce it, except that data subjects may
        enforce rights expressly conferred on them by the Standard Contractual
        Clauses to the extent those clauses so require.
      </p>
      <p>
        <strong>18.5 Governing law.</strong> This DPA, and any dispute or claim
        (including non-contractual disputes or claims) arising out of or in
        connection with it or its subject matter, is governed by and construed
        in accordance with the laws of{" "}
        <strong>the jurisdiction in which Cradle Labs Limited is incorporated</strong>
        , consistent with the Product Terms, save that, in respect of Restricted
        Transfers, the governing law and forum specified by or under the
        Standard Contractual Clauses prevail to the extent required by them.
      </p>
      <p>
        <strong>18.6 Counterparts and electronic acceptance.</strong> This DPA
        may be accepted and executed electronically and/or via the Order,
        including in counterparts, each of which is an original and all of which
        together constitute one instrument. Signature, party and Order-specific
        details are completed by the parties on execution.
      </p>

      <h2>Annex 1 — Details of Processing</h2>
      <p>
        <strong>Subject-matter.</strong> The processing of Customer Personal
        Data by Cradle Labs as processor in order to provide the hosted
        Overwatch Service to the Customer.
      </p>
      <p>
        <strong>Duration.</strong> For the duration of the Customer&apos;s use
        of the hosted Overwatch Service under the Product Terms and the Order,
        followed by deletion or return in accordance with Clause 13.
      </p>
      <p>
        <strong>Nature and purpose.</strong> Capture, ingestion, transmission,
        storage, organisation, analysis, forwarding to AI Sub-processors for
        incident detection and scene understanding, generation of detections,
        notifications and analytics, and related hosting, security, support and
        service-operation activities, all to provide, maintain and support the
        hosted Overwatch Service.
      </p>
      <p>
        <strong>Types of personal data:</strong>
      </p>
      <ul>
        <li>Camera video and image footage captured by the Customer&apos;s cameras;</li>
        <li>Any audio where enabled by the Customer;</li>
        <li>
          Timestamps and metadata associated with Footage (including device,
          camera and event metadata);
        </li>
        <li>AI-derived detections and analytics (probabilistic, assistive outputs);</li>
        <li>
          The Customer&apos;s authorised-user account and contact data (such as
          names, business contact details and credentials of users the Customer
          authorises);
        </li>
        <li>
          Special category and/or biometric data (for example, where facial
          recognition is configured) only if and to the extent configured or
          enabled by the Customer, which is the Customer&apos;s responsibility
          under Clause 4.
        </li>
      </ul>
      <p>
        <strong>Categories of data subjects:</strong>
      </p>
      <ul>
        <li>
          Individuals captured by the Customer&apos;s cameras (for example,
          visitors, customers, passers-by, contractors and staff);
        </li>
        <li>
          The Customer&apos;s authorised users and personnel who access or
          administer the Overwatch Service.
        </li>
      </ul>
      <p>
        <strong>Frequency of processing.</strong> Continuous, for the duration
        of the hosted Overwatch Service.
      </p>
      <p>
        <strong>Controller and processor.</strong> Controller: the Customer, as
        identified in the Order. Processor: Cradle Labs Limited. Sub-processors:
        as described in Annex 3.
      </p>
      <p>
        <strong>Retention.</strong> As set out in the Product Terms and the
        applicable Order (limited retention), with deletion or return on
        termination or expiry in accordance with Clause 13, save where retention
        is required by applicable law.
      </p>

      <h2>Annex 2 — Technical and Organisational Measures</h2>
      <p>
        Cradle Labs implements and maintains, at minimum, the following
        measures, appropriate to high-volume video data and subject to ongoing
        review and improvement (and which may be updated but not materially
        weakened for active processing):
      </p>
      <ul>
        <li>
          <strong>Encryption:</strong> encryption of Customer Personal Data in
          transit and at rest using industry-standard algorithms; key
          management with controlled generation, storage, rotation and
          revocation of cryptographic keys.
        </li>
        <li>
          <strong>Access control:</strong> role-based access on a
          least-privilege, need-to-know basis; multi-factor authentication for
          administrative and remote access; unique credentials; logging and
          monitoring of access to Customer Personal Data and administrative
          actions; timely revocation of access on role change or departure.
        </li>
        <li>
          <strong>Tenant and data segregation:</strong> logical separation of
          each Customer&apos;s data and environments to prevent unauthorised
          access across tenants.
        </li>
        <li>
          <strong>Network and infrastructure security:</strong> firewalls,
          network segmentation, secure configuration baselines, hardening, and
          protection against malicious traffic and intrusion.
        </li>
        <li>
          <strong>Secure development and change management:</strong> secure
          software development lifecycle practices, code review, segregation of
          environments, and controlled, documented change management.
        </li>
        <li>
          <strong>Vulnerability and patch management:</strong> regular
          vulnerability scanning, timely remediation, and periodic penetration
          testing by qualified testers.
        </li>
        <li>
          <strong>Monitoring and alerting:</strong> security monitoring,
          logging, anomaly detection and alerting across relevant systems.
        </li>
        <li>
          <strong>Backup, resilience and business continuity:</strong> regular
          backups, redundancy, and tested business continuity and disaster
          recovery arrangements appropriate to the service.
        </li>
        <li>
          <strong>Data minimisation and pseudonymisation:</strong> processing
          limited to what is necessary; pseudonymisation or de-identification
          applied where feasible and appropriate.
        </li>
        <li>
          <strong>Physical and environmental security:</strong> physical access
          controls and environmental safeguards for facilities, including as
          provided by infrastructure Sub-processors operating certified
          data-centre facilities.
        </li>
        <li>
          <strong>Personnel measures:</strong> appropriate background vetting
          where lawful, security and data protection training, and binding
          confidentiality obligations.
        </li>
        <li>
          <strong>Incident response and breach management:</strong> documented
          incident response procedures, including detection, escalation,
          containment, remediation and notification in accordance with Clause 9.
        </li>
        <li>
          <strong>Secure deletion:</strong> secure deletion and disposal of
          Customer Personal Data and media in accordance with Clause 13.
        </li>
        <li>
          <strong>Sub-processor security diligence:</strong> risk-based security
          assessment of Sub-processors and imposition of equivalent security
          obligations under Clause 7.
        </li>
      </ul>

      <h2>Annex 3 — Sub-processors</h2>
      <p>
        Cradle Labs engages Sub-processors by category (specific vendors are
        identified in the maintained list referred to below, not in this
        Annex):
      </p>
      <ul>
        <li>
          (a) <strong>Cloud hosting, compute and storage infrastructure</strong>{" "}
          providers for ingestion, processing and storage of Footage and related
          data;
        </li>
        <li>
          (b) <strong>Third-party AI/ML inference providers</strong> for
          incident detection and scene understanding. These providers are
          contractually restricted from using Customer Personal Data (including
          Footage, frames or derived data) to train, fine-tune, develop or
          improve their own or any third party&apos;s models, products or
          services, and may process such data only to provide the relevant
          functionality back to Cradle Labs in accordance with Cradle Labs&apos;
          instructions and for no other purpose (Clauses 7.4 and 16.2);
        </li>
        <li>
          (c) <strong>Content delivery and storage</strong> providers supporting
          delivery and retention of Footage and derived content;
        </li>
        <li>
          (d) <strong>Notification delivery providers</strong>, including
          messaging platforms (for example, WhatsApp and Telegram) and
          email/SMS gateways, used to deliver alerts and notifications;
        </li>
        <li>
          (e) <strong>Operational tooling</strong> providers for logging,
          monitoring and error tracking used to operate and secure the Overwatch
          Service.
        </li>
      </ul>
      <p>
        <strong>Change notification and objection.</strong> Cradle Labs gives
        prior notice of intended additions or replacements of Sub-processors and
        the Customer may reasonably object in accordance with Clause 7.2. The
        current list of Sub-processors is maintained by Cradle Labs and is
        obtainable, and notice of changes is given, by contacting{" "}
        <a href="mailto:hello@dterminal.net">hello@dterminal.net</a> (or by such
        other notification means as Cradle Labs makes available and notifies to
        the Customer).
      </p>

      <h2>Annex 4 — International Transfers</h2>
      <p>
        <strong>Applicable mechanisms.</strong> Where any processing under this
        DPA involves a Restricted Transfer, the <strong>EU Standard Contractual
        Clauses</strong> apply and, for transfers subject to UK law, the{" "}
        <strong>UK Addendum/IDTA</strong> applies, in each case incorporated by
        reference under Clause 11.
      </p>
      <p>
        <strong>Module 2 (controller to processor).</strong> For transfers of
        Customer Personal Data from the Customer to Cradle Labs,{" "}
        <strong>Module Two</strong> of the EU SCCs applies, with the{" "}
        <strong>Customer as data exporter</strong> and{" "}
        <strong>Cradle Labs as data importer</strong>.
      </p>
      <p>
        <strong>Module 3 (processor to sub-processor).</strong> For onward
        transfers of Customer Personal Data from Cradle Labs to a Sub-processor,{" "}
        <strong>Module Three</strong> of the EU SCCs applies, with Cradle Labs
        as data exporter and the relevant Sub-processor as data importer.
      </p>
      <p>
        <strong>Docking clause.</strong> The docking clause of the EU SCCs
        applies, permitting additional entities to accede as exporter or
        importer in accordance with that clause.
      </p>
      <p>
        <strong>Operative selections.</strong> The descriptions of the parties,
        processing, transfer details and competent supervisory authority are
        populated by the corresponding particulars in Annex 1, Annex 3 and the
        Order. Operative clause selections within the SCC mechanics — including
        any optional clauses (such as the option for general written
        authorisation of sub-processors, consistent with Clause 7), the audit
        arrangements (read consistently with Clause 12), the redress and
        third-party-beneficiary provisions, and the governing law and forum
        within the SCC framework — are completed by and within the Standard
        Contractual Clauses framework and the Order, consistent with this DPA
        and the parties&apos; agreement, and prevail over inconsistent terms
        only in respect of Restricted Transfers (Clauses 1.3 and 11.5).
      </p>
      <p>
        <strong>Transfer impact and supplementary measures.</strong> The parties
        will cooperate on any required transfer impact assessment, and Cradle
        Labs applies appropriate supplementary technical, organisational and
        contractual measures (consistent with Annex 2 and Clause 11.4) where
        necessary to ensure that transferred Customer Personal Data receives a
        level of protection essentially equivalent to that required by the Data
        Protection Laws.
      </p>
    </LegalPage>
  );
}
