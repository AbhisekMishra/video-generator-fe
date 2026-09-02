import Link from "next/link";
import { Navbar } from "@/components/navbar";

export const metadata = {
  title: "Refund Policy — ClipAI",
};

export default function RefundPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="container mx-auto px-4 py-12 max-w-3xl flex-1">
        <h1 className="text-3xl font-bold mb-2">Refund & Cancellation Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: September 2, 2026</p>

        <div className="prose prose-sm max-w-none space-y-6 text-sm leading-relaxed text-foreground/90">
          <section>
            <h2 className="text-lg font-semibold mt-8 mb-2">Cancelling your subscription</h2>
            <p>
              You can cancel your Starter or Pro subscription at any time from the
              "Manage Billing" link in the app, which opens your Lemon Squeezy
              customer portal. When you cancel, your subscription won't renew, but
              you keep full access to your plan's features and quota until the end
              of the period you've already paid for. Your plan then reverts to Free.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mt-8 mb-2">Refunds</h2>
            <p>
              Because ClipAI usage is metered (clip attempts) and consumed as you
              use it, we don't offer automatic refunds for partial billing periods
              or unused attempts. If something went wrong on our end — a billing
              error, a duplicate charge, or a technical failure that prevented you
              from using the Service you paid for — email us within 14 days of the
              charge at{" "}
              <a href="mailto:abhisekmishra55@gmail.com" className="text-primary hover:underline">
                abhisekmishra55@gmail.com
              </a>{" "}
              and we'll review it in good faith on a case-by-case basis.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mt-8 mb-2">Failed payments</h2>
            <p>
              If a renewal payment fails, Lemon Squeezy will automatically retry the
              charge. Your plan remains active during this retry window; if all
              retries fail, your subscription is marked expired and your plan
              reverts to Free.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mt-8 mb-2">How refunds are processed</h2>
            <p>
              Approved refunds are issued by Lemon Squeezy (our payment processor
              and merchant of record) back to your original payment method, and
              typically appear within 5–10 business days depending on your bank or
              card issuer.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mt-8 mb-2">Questions</h2>
            <p>
              See our{" "}
              <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>{" "}
              for the full terms, or email{" "}
              <a href="mailto:abhisekmishra55@gmail.com" className="text-primary hover:underline">
                abhisekmishra55@gmail.com
              </a>{" "}
              with any billing question.
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
