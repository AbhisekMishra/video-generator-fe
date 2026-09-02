import Link from "next/link";
import { Navbar } from "@/components/navbar";

export const metadata = {
  title: "Terms of Service — ClipAI",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="container mx-auto px-4 py-12 max-w-3xl flex-1">
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: September 2, 2026</p>

        <div className="prose prose-sm max-w-none space-y-6 text-sm leading-relaxed text-foreground/90">
          <p>
            ClipAI is operated by an individual sole operator ("we", "us"). These Terms
            govern your use of the ClipAI website and service (the "Service"), which
            converts long-form video into short, captioned clips using automated
            transcription and AI-assisted clip selection. By creating an account or
            using the Service, you agree to these Terms.
          </p>

          <section>
            <h2 className="text-lg font-semibold mt-8 mb-2">1. The Service</h2>
            <p>
              You provide a video (by upload or YouTube link). We transcribe it,
              use an AI model to identify candidate clips, generate captions, and
              render short vertical clips for you to download or share. Processing
              time varies with video length and current load.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mt-8 mb-2">2. Your account</h2>
            <p>
              You're responsible for keeping your login credentials secure and for
              all activity under your account. You must be legally able to enter into
              this agreement to use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mt-8 mb-2">3. Your content</h2>
            <p>
              You retain ownership of any video you submit and the clips generated
              from it. You're solely responsible for having the rights to any video
              you upload or link to — don't submit content you don't have permission
              to use, or content that infringes someone else's rights, is illegal, or
              violates YouTube's own Terms of Service (for YouTube links). We may
              remove content or suspend accounts that violate this.
            </p>
            <p>
              To provide the Service, you grant us a limited license to store,
              process, and transmit your video and its derived transcript/clips —
              including sending the transcript text to our AI provider for clip
              selection (see our{" "}
              <Link href="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
              ). We don't use your video content to train AI models, and we don't
              sell your content to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mt-8 mb-2">4. Plans, billing, and quotas</h2>
            <p>
              The Free plan includes a limited number of lifetime clip attempts.
              Paid plans (Starter, Pro) are billed monthly in advance through Lemon
              Squeezy, our payment processor and merchant of record, and include a
              higher monthly attempt allowance that resets each billing cycle. See our{" "}
              <Link href="/refund" className="text-primary hover:underline">
                Refund Policy
              </Link>{" "}
              for cancellation and refund terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mt-8 mb-2">5. Acceptable use</h2>
            <p>
              Don't use the Service to process content that is illegal, infringing,
              or that you don't have rights to; don't attempt to abuse, overload, or
              circumvent quota/rate limits; don't attempt to gain unauthorized access
              to the Service or other users' data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mt-8 mb-2">6. No warranty; limitation of liability</h2>
            <p>
              The Service is provided "as is." AI-selected clips and automated
              captions may contain errors — review output before publishing it
              anywhere. To the maximum extent permitted by law, we are not liable
              for indirect, incidental, or consequential damages arising from your
              use of the Service, and our total liability for any claim is limited
              to the amount you paid us in the 3 months before the claim arose.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mt-8 mb-2">7. Termination</h2>
            <p>
              You may stop using the Service and delete your account at any time.
              We may suspend or terminate accounts that violate these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mt-8 mb-2">8. Changes</h2>
            <p>
              We may update these Terms from time to time. Continued use of the
              Service after a change means you accept the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mt-8 mb-2">9. Contact</h2>
            <p>
              Questions about these Terms? Reach us at{" "}
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
