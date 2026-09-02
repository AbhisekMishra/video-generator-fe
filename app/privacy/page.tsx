import Link from "next/link";
import { Navbar } from "@/components/navbar";

export const metadata = {
  title: "Privacy Policy — ClipAI",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="container mx-auto px-4 py-12 max-w-3xl flex-1">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: September 2, 2026</p>

        <div className="prose prose-sm max-w-none space-y-6 text-sm leading-relaxed text-foreground/90">
          <p>
            This page explains what data ClipAI collects, why, and who it's shared
            with. ClipAI is operated by an individual sole operator.
          </p>

          <section>
            <h2 className="text-lg font-semibold mt-8 mb-2">1. What we collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Account data:</strong> your email address and password (password is hashed and never visible to us — authentication is handled by Supabase).</li>
              <li><strong>Video content:</strong> videos you upload, or YouTube URLs you submit, plus the transcript, captions, and clips generated from them.</li>
              <li><strong>Usage data:</strong> how many clips you've generated, your plan tier, and processing status/history for your sessions.</li>
              <li><strong>Billing data:</strong> if you subscribe to a paid plan, our payment processor (Lemon Squeezy) collects your payment details directly — we never see or store your card number. We receive your subscription status, renewal date, and a customer/subscription ID.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mt-8 mb-2">2. How we use it</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To run the Service: transcribing your video, selecting clips, generating captions, and rendering output.</li>
              <li>To enforce plan quotas and manage your subscription.</li>
              <li>To operate, secure, and improve the Service (e.g. diagnosing failures).</li>
            </ul>
            <p>We do not sell your data, and we do not use your video content to train AI models.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mt-8 mb-2">3. Who we share it with</h2>
            <p>We use the following third-party service providers to run ClipAI. Each only receives the data it needs to perform its function:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Supabase</strong> — authentication, database, and file storage for your account, sessions, and video/clip files.</li>
              <li><strong>Anthropic (Claude)</strong> — your video's transcript text is sent to Claude to identify the best clip segments. Anthropic does not receive your raw video file, only transcript text.</li>
              <li><strong>Lemon Squeezy</strong> — payment processing and billing for paid plans; acts as merchant of record for your purchase.</li>
              <li><strong>Vercel</strong> and <strong>Railway</strong> — hosting for our website and processing backend.</li>
            </ul>
            <p>
              We don't share your data with anyone else except where required by law,
              to protect our legal rights, or with your consent.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mt-8 mb-2">4. Storage and retention</h2>
            <p>
              Your uploaded videos, transcripts, and generated clips are stored on
              our behalf by Supabase and kept for as long as your account and
              sessions exist. Deleting a video/session from your dashboard deletes
              its associated files. Deleting your account removes your account data;
              contact us if you'd like assistance fully removing your data sooner.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mt-8 mb-2">5. Your choices</h2>
            <p>
              You can delete individual videos/sessions at any time from your
              dashboard. You can request a copy of your data, or full account
              deletion, by emailing us (see below). You can cancel a paid
              subscription at any time from the billing portal.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mt-8 mb-2">6. Security</h2>
            <p>
              We use industry-standard practices (encrypted connections, access
              controls, and row-level security on our database) to protect your
              data, but no system is 100% secure. If you believe your account has
              been compromised, contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mt-8 mb-2">7. Changes to this policy</h2>
            <p>We may update this policy from time to time; the "Last updated" date above will reflect the latest revision.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mt-8 mb-2">8. Contact</h2>
            <p>
              Questions about this policy, or a data request? Email{" "}
              <a href="mailto:abhisekmishra55@gmail.com" className="text-primary hover:underline">
                abhisekmishra55@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </main>
      <footer className="border-t mt-16 py-8">
        <div className="container mx-auto px-4 max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} ClipAI. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/refund" className="hover:text-foreground">Refunds</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
