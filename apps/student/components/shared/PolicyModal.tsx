"use client"
import { X } from "lucide-react"

// ─── POLICY MODAL & CONTENT ───────────────────────────────────────────────
export type PolicyType = "terms" | "privacy" | "refund"

export function PolicyModal({ type, onClose }: { type: PolicyType | null; onClose: () => void }) {
  if (!type) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="p-8 pt-14">
          {type === "terms" && <TermsContent />}
          {type === "privacy" && <PrivacyContent />}
          {type === "refund" && <RefundContent />}
        </div>
      </div>
    </div>
  )
}

function TermsContent() {
  return (
    <div className="space-y-6 text-slate-600 leading-relaxed">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900">Terms & Conditions</h2>
        <p className="text-sm text-slate-500 mt-1">Last Updated: July 27, 2026</p>
      </div>
      <p>
        Welcome to OSSSC.Online, an initiative by ABC Skills. These Terms & Conditions (&quot;Terms&quot;) govern your access to and use of the OSSSC.Online website, mobile platform, mock tests, study materials, and related services (collectively, the &quot;Platform&quot;). By accessing or using the Platform, you agree to be bound by these Terms. If you do not agree, please do not use the Platform.
      </p>

      <section className="space-y-2">
        <h3 className="font-bold text-slate-900">1. Eligibility</h3>
        <p>
          The Platform is intended for use by GNM and Nursing graduates with relevant work experience who are preparing for the OSSSC Nursing Officer recruitment examination or similar government nursing recruitment exams. By using the Platform, you confirm that the information you provide (including educational qualifications and experience) is accurate and truthful.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-bold text-slate-900">2. Account Registration</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>You may be required to create an account using your email address or phone number to access certain features.</li>
          <li>You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account.</li>
          <li>You must notify us immediately of any unauthorized use of your account.</li>
          <li>We reserve the right to suspend or terminate accounts that provide false information or violate these Terms.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="font-bold text-slate-900">3. Services Provided</h3>
        <p>OSSSC.Online offers:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Free and premium mock tests designed to simulate the OSSSC exam pattern</li>
          <li>A live-alike mock test environment developed by ABC Skills</li>
          <li>Subject-wise practice questions and study materials</li>
          <li>Odisha-specific general knowledge and current affairs content</li>
          <li>Performance tracking and analytics</li>
          <li>Exam notifications and updates</li>
        </ul>
        <p>
          We make reasonable efforts to ensure the accuracy and relevance of our content but do not guarantee that our materials cover every topic that may appear in the actual OSSSC examination.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-bold text-slate-900">4. No Guarantee of Exam Results</h3>
        <p>
          While our mock tests, questions, and study materials are curated with input from experienced medical and nursing professionals, OSSSC.Online does not guarantee selection, qualification, or any specific score in the OSSSC Nursing Officer exam or any other examination. Success depends on multiple factors, including individual preparation, and is solely the responsibility of the candidate.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-bold text-slate-900">5. Payments and Subscriptions</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Certain features (premium mock tests, advanced study materials, etc.) may require payment of applicable fees.</li>
          <li>All fees are stated in Indian Rupees (INR) unless otherwise specified.</li>
          <li>Payments must be made through the payment methods supported on the Platform.</li>
          <li>Prices, plans, and features are subject to change at our discretion, with prior notice where reasonably possible.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="font-bold text-slate-900">6. Refund Policy</h3>
        <p>
          Refunds, where applicable, are governed by our separate Refund Policy. Please refer to that page for details on eligibility and process.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-bold text-slate-900">7. User Conduct</h3>
        <p>You agree not to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Share, resell, or redistribute paid content, mock tests, or study materials without authorization</li>
          <li>Use automated tools, bots, or scripts to access or scrape content from the Platform</li>
          <li>Attempt to reverse-engineer, copy, or replicate the mock test environment or question banks</li>
          <li>Engage in any activity that disrupts or interferes with the Platform&apos;s functioning</li>
          <li>Impersonate any person or entity, or misrepresent your affiliation</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="font-bold text-slate-900">8. Intellectual Property</h3>
        <p>
          All content on the Platform — including but not limited to questions, mock tests, study materials, the live-alike test environment, graphics, logos, and text — is the intellectual property of ABC Skills / OSSSC.Online and is protected under applicable copyright and intellectual property laws. Unauthorized reproduction, distribution, or commercial use of this content is strictly prohibited.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-bold text-slate-900">9. Third-Party Links</h3>
        <p>
          The Platform may contain links to third-party websites or resources. We are not responsible for the content, accuracy, or practices of any third-party sites, and inclusion of such links does not imply endorsement.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-bold text-slate-900">10. Limitation of Liability</h3>
        <p>
          To the maximum extent permitted by law, OSSSC.Online and ABC Skills shall not be liable for any direct, indirect, incidental, or consequential damages arising from your use of, or inability to use, the Platform, including but not limited to exam performance, technical errors, or data loss.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-bold text-slate-900">11. Accuracy of Content & Evolving Medical Guidelines</h3>
        <p>
          Medical and nursing science is a constantly evolving field. Clinical guidelines, protocols, nomenclature, drug information, treatment procedures, and best practices are periodically revised by regulatory bodies, medical associations, and health authorities, both in India and internationally. As a result, certain answers, explanations, or content within our mock tests, question banks, and study materials may reflect the guidelines or standards prevailing at the time such content was created, and may not always align with the most current updates or revisions in medical science.
        </p>
        <p>
          Additionally, despite our best efforts to review and verify all content for accuracy, unintentional typographical errors, factual inaccuracies, or discrepancies may occasionally occur in questions, answer options, or explanations due to human error during content creation, editing, or publishing.
        </p>
        <p>By using the Platform, you acknowledge and agree that:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>OSSSC.Online and ABC Skills do not guarantee that all content will remain accurate, current, or error-free at all times, given the evolving nature of medical science and the possibility of inadvertent human error.</li>
          <li>Any such discrepancies, outdated information, or typographical errors are unintentional, and the organisation shall not be held liable for any loss, inconvenience, confusion, or impact on exam performance arising from such errors.</li>
          <li>OSSSC.Online and ABC Skills shall be immune from any claims, disputes, or liability arising out of unforeseen and unintentional inaccuracies in content, including but not limited to changes in medical guidelines occurring after content publication, and clerical or typographical errors.</li>
          <li>Users are encouraged to cross-verify critical medical information with official, updated sources and current examination syllabi, and to report any errors they identify so that we can review and correct them promptly.</li>
          <li>We reserve the right to update, correct, or revise any content on the Platform at any time, without prior notice, as part of our ongoing effort to maintain the highest possible standard of accuracy.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="font-bold text-slate-900">12. Modifications to Terms</h3>
        <p>
          We reserve the right to update or modify these Terms at any time. Continued use of the Platform after changes are posted constitutes your acceptance of the revised Terms. We encourage you to review this page periodically.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-bold text-slate-900">13. Termination</h3>
        <p>
          We reserve the right to suspend or terminate your access to the Platform, without prior notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-bold text-slate-900">14. Governing Law and Jurisdiction</h3>
        <p>
          These Terms shall be governed by and construed in accordance with the laws of India. Any disputes arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts in Bhubaneswar, Odisha.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-bold text-slate-900">15. Contact Us</h3>
        <p>If you have any questions about these Terms, please contact us at:</p>
        <ul className="list-none pl-0 space-y-1">
          <li>
            📧 <a href="mailto:abcsupportindia@gmail.com" className="text-sky-600 hover:underline">abcsupportindia@gmail.com</a>
          </li>
          <li>📍 Bhubaneswar, Odisha</li>
        </ul>
      </section>
    </div>
  )
}

function RefundContent() {
  return (
    <div className="space-y-6 text-slate-600 leading-relaxed">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900">Refund Policy</h2>
        <p className="text-sm text-slate-500 mt-1">Last Updated: July 27, 2026</p>
      </div>
      <p>
        This Refund Policy applies to all paid services offered on OSSSC.Online, an initiative by ABC Skills.
      </p>

      <section className="space-y-2">
        <h3 className="font-bold text-slate-900">1. General Policy</h3>
        <p>
          Given the digital nature of our mock tests, study materials, and premium content, all sales are generally final once access has been granted. However, we want our users to be satisfied, so the exceptions below outline when a refund may be considered.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-bold text-slate-900">2. Eligibility for Refund</h3>
        <p>You may be eligible for a refund if:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>You were charged multiple times for the same subscription or product due to a technical error</li>
          <li>You purchased a premium plan but were unable to access it due to a verified technical issue on our end that we could not resolve within a reasonable time</li>
          <li>You cancel a subscription within 24 hours of purchase, provided you have not accessed any premium mock tests, question banks, or downloadable materials</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="font-bold text-slate-900">3. Non-Refundable Situations</h3>
        <p>Refunds will not be provided in the following cases:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>You have accessed, attempted, or downloaded any premium mock test, question bank, or study material</li>
          <li>Change of mind after accessing paid content</li>
          <li>Failure to clear the OSSSC exam or any other examination</li>
          <li>Incorrect purchase due to user error (e.g., wrong plan selected), once the plan has been activated and accessed</li>
          <li>Requests made after the eligible refund window has passed</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="font-bold text-slate-900">4. How to Request a Refund</h3>
        <p>To request a refund, please contact us at <a href="mailto:abcsupportindia@gmail.com" className="text-sky-600 hover:underline">abcsupportindia@gmail.com</a> within the eligible window, along with:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Your registered email/phone number</li>
          <li>Transaction ID or payment reference</li>
          <li>Reason for the refund request</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="font-bold text-slate-900">5. Refund Processing</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Approved refunds will be processed within 7–10 business days to the original payment method.</li>
          <li>Processing times may vary depending on your bank or payment provider.</li>
          <li>We reserve the right to approve or deny refund requests at our discretion based on the criteria above.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="font-bold text-slate-900">6. Subscription Cancellations</h3>
        <p>
          You may cancel a recurring subscription at any time. Cancellation will stop future billing but does not automatically entitle you to a refund for the current billing period, unless it falls under the eligibility criteria in Section 2.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-bold text-slate-900">7. Contact Us</h3>
        <p>For refund-related queries, reach out to:</p>
        <ul className="list-none pl-0 space-y-1">
          <li>
            📧 <a href="mailto:abcsupportindia@gmail.com" className="text-sky-600 hover:underline">abcsupportindia@gmail.com</a>
          </li>
          <li>📍 Bhubaneswar, Odisha</li>
        </ul>
      </section>
    </div>
  )
}

function PrivacyContent() {
  return (
    <div className="space-y-6 text-slate-600 leading-relaxed">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900">Privacy Policy</h2>
        <p className="text-sm text-slate-500 mt-1">Last Updated: July 27, 2026</p>
      </div>
      <p>
        OSSSC.Online, an initiative by ABC Skills (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;), is committed to protecting your privacy. This Privacy Policy explains how we collect, use, store, and protect your personal information when you use our Platform.
      </p>

      <section className="space-y-2">
        <h3 className="font-bold text-slate-900">1. Information We Collect</h3>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>a) Information You Provide:</strong>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li>Name, email address, and phone number (used for account registration and OTP-based login)</li>
              <li>Educational qualifications and work experience details (for eligibility/profile purposes)</li>
              <li>Payment information (processed via third-party payment gateways — we do not store your full card/bank details on our servers)</li>
            </ul>
          </li>
          <li>
            <strong>b) Information Collected Automatically:</strong>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li>Device information, browser type, and IP address</li>
              <li>Usage data such as pages visited, mock tests attempted, time spent, and performance analytics</li>
              <li>Cookies and similar tracking technologies (see Section 6)</li>
            </ul>
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="font-bold text-slate-900">2. How We Use Your Information</h3>
        <p>We use your information to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Create and manage your account, including OTP-based email login and authentication</li>
          <li>Provide access to mock tests, study materials, and premium features</li>
          <li>Track and display your performance analytics</li>
          <li>Send exam updates, notifications, and important announcements</li>
          <li>Process payments and manage subscriptions</li>
          <li>Improve our Platform, content, and user experience</li>
          <li>Respond to support requests and communications</li>
          <li>Comply with legal obligations</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="font-bold text-slate-900">3. OTP-Based Login & Account Security</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>We use One-Time Password (OTP) verification sent to your registered email for secure login.</li>
          <li>OTPs are time-limited and single-use for security purposes.</li>
          <li>We recommend not sharing your OTP or login credentials with anyone.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="font-bold text-slate-900">4. Data Sharing and Disclosure</h3>
        <p>We do not sell your personal information. We may share your information with:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Payment processors to complete transactions securely</li>
          <li>Service providers who help us operate the Platform (e.g., hosting, email/SMS delivery, analytics)</li>
          <li>Legal authorities, if required by law, court order, or government regulation</li>
          <li>In connection with a business transfer (e.g., merger, acquisition), where your data may be transferred as part of that transaction, subject to confidentiality</li>
        </ul>
        <p>We do not share your data with third parties for their own marketing purposes without your consent.</p>
      </section>

      <section className="space-y-2">
        <h3 className="font-bold text-slate-900">5. Data Storage and Security</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Your data is stored on secure servers with reasonable technical and organizational safeguards in place.</li>
          <li>While we take data protection seriously, no method of transmission or storage is 100% secure, and we cannot guarantee absolute security.</li>
          <li>Payment data is handled by PCI-DSS compliant third-party payment gateways; we do not store complete card details.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="font-bold text-slate-900">6. Cookies and Tracking</h3>
        <p>We use cookies and similar technologies to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Keep you logged in during your session</li>
          <li>Understand usage patterns and improve the Platform</li>
          <li>Remember your preferences</li>
        </ul>
        <p>
          You can control cookie settings through your browser, though disabling cookies may affect certain features of the Platform.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-bold text-slate-900">7. Your Rights</h3>
        <p>You have the right to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Access the personal information we hold about you</li>
          <li>Request correction of inaccurate or incomplete information</li>
          <li>Request deletion of your account and associated data, subject to any legal retention requirements</li>
          <li>Withdraw consent for non-essential communications (e.g., promotional emails/SMS) at any time</li>
        </ul>
        <p>
          To exercise these rights, contact us at <a href="mailto:abcsupportindia@gmail.com" className="text-sky-600 hover:underline">abcsupportindia@gmail.com</a>.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-bold text-slate-900">8. Data Retention</h3>
        <p>
          We retain your personal information for as long as your account is active or as needed to provide our services, comply with legal obligations, resolve disputes, and enforce our agreements.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-bold text-slate-900">9. Children&apos;s Privacy</h3>
        <p>
          The Platform is intended for use by individuals who meet the eligibility criteria for nursing recruitment exams (i.e., adults with relevant qualifications and experience). We do not knowingly collect information from minors.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-bold text-slate-900">10. Changes to This Policy</h3>
        <p>
          We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated &quot;Last Updated&quot; date. Continued use of the Platform after changes constitutes acceptance of the revised policy.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-bold text-slate-900">11. Contact Us</h3>
        <p>For any privacy-related questions or requests, contact us at:</p>
        <ul className="list-none pl-0 space-y-1">
          <li>
            📧 <a href="mailto:abcsupportindia@gmail.com" className="text-sky-600 hover:underline">abcsupportindia@gmail.com</a>
          </li>
          <li>📍 Bhubaneswar, Odisha</li>
        </ul>
      </section>
    </div>
  )
}
