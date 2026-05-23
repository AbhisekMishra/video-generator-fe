"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Sparkles, Zap, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/navbar";
import { AuthModal } from "@/components/auth-modal";
import { useAuth } from "@/contexts/auth-context";

interface Plan {
  tier: "free" | "starter" | "pro";
  name: string;
  price: number;
  limit: number;
  features: string[];
  icon: React.ElementType;
  highlighted: boolean;
}

const PLANS: Plan[] = [
  {
    tier: "free",
    name: "Free",
    price: 0,
    limit: 3,
    icon: Sparkles,
    highlighted: false,
    features: [
      "3 videos per month",
      "AI clip selection",
      "Auto captions",
      "Portrait 9:16 crop",
    ],
  },
  {
    tier: "starter",
    name: "Starter",
    price: 9,
    limit: 20,
    icon: Zap,
    highlighted: false,
    features: [
      "20 videos per month",
      "AI clip selection",
      "Auto captions",
      "Portrait 9:16 crop",
      "Priority processing",
    ],
  },
  {
    tier: "pro",
    name: "Pro",
    price: 29,
    limit: 100,
    icon: Rocket,
    highlighted: true,
    features: [
      "100 videos per month",
      "AI clip selection",
      "Auto captions",
      "Portrait 9:16 crop",
      "Priority processing",
      "Early access to new features",
    ],
  },
];

export default function PricingPage() {
  const { user } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = async (tier: "starter" | "pro") => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    setLoadingTier(tier);
    setError(null);
    try {
      const res = await fetch("/api/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create checkout session");

      // Stripe checkout URL is external — must use window.location, not router.push
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setLoadingTier(null);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
      <Navbar onSignInClick={() => setShowAuthModal(true)} />

      <main className="container mx-auto px-4 py-16 max-w-5xl flex-1">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold tracking-tight mb-3">Simple, transparent pricing</h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Start free, upgrade when you need more. No hidden fees.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/5 border border-destructive/20 rounded-lg text-sm text-destructive text-center">
            {error}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            return (
              <div
                key={plan.tier}
                className={`relative rounded-2xl border p-7 flex flex-col gap-6 ${
                  plan.highlighted
                    ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                    : "bg-card shadow-sm"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${plan.highlighted ? "bg-primary/20" : "bg-muted"}`}>
                      <Icon className={`w-4 h-4 ${plan.highlighted ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <h2 className="text-lg font-bold">{plan.name}</h2>
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold">${plan.price}</span>
                    {plan.price > 0 && (
                      <span className="text-muted-foreground text-sm">/month</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {plan.limit} videos per month
                  </p>
                </div>

                <ul className="flex flex-col gap-2.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                {plan.tier === "free" ? (
                  <Button variant="outline" className="w-full" asChild>
                    <Link href={user ? "/?new=1" : "#"} onClick={!user ? () => setShowAuthModal(true) : undefined}>
                      Get started free
                    </Link>
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    variant={plan.highlighted ? "default" : "outline"}
                    onClick={() => handleUpgrade(plan.tier as "starter" | "pro")}
                    disabled={loadingTier === plan.tier}
                  >
                    {loadingTier === plan.tier ? "Redirecting..." : `Upgrade to ${plan.name}`}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-10">
          Payments processed securely by Stripe. Cancel anytime.
        </p>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 max-w-5xl text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} ClipAI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
