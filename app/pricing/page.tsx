"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { AuthModal } from "@/components/auth-modal";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UserQuota } from "@/lib/quota";
import { PLANS } from "@/lib/lemonsqueezy-plans";

interface PlanCard {
  tier: "free" | "starter" | "pro";
  name: string;
  price: string;
  cadence: string;
  attempts: string;
  features: string[];
  highlighted?: boolean;
}

// price/attemptsLimit for starter & pro come from lib/lemonsqueezy-plans.ts's PLANS — the
// single source of truth shared with the checkout/webhook routes. Only presentation
// (marketing copy, feature bullets, which card to highlight) lives here.
const PLAN_CARDS: PlanCard[] = [
  {
    tier: "free",
    name: "Free",
    price: "$0",
    cadence: "forever",
    attempts: "3 clips total",
    features: ["Auto transcription", "Smart clip selection", "Portrait rendering"],
  },
  {
    tier: "starter",
    name: PLANS.starter.name,
    price: PLANS.starter.price,
    cadence: PLANS.starter.cadence,
    attempts: `${PLANS.starter.attemptsLimit} clips/month`,
    features: ["Everything in Free", "Resets monthly", "Priority queue"],
    highlighted: true,
  },
  {
    tier: "pro",
    name: PLANS.pro.name,
    price: PLANS.pro.price,
    cadence: PLANS.pro.cadence,
    attempts: `${PLANS.pro.attemptsLimit} clips/month`,
    features: ["Everything in Starter", "Higher monthly volume", "Priority support"],
  },
];

export default function PricingPage() {
  const { user, loading: authLoading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [quota, setQuota] = useState<UserQuota | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setQuota(null);
      return;
    }
    fetch("/api/quota")
      .then((res) => res.json())
      .then((data) => setQuota(data.quota))
      .catch(() => {});
  }, [user]);

  const handleUpgrade = async (tier: "starter" | "pro") => {
    if (authLoading) return;
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    setError(null);
    setCheckoutLoading(tier);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: tier }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to start checkout");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start checkout");
      setCheckoutLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
      <Navbar onSignInClick={() => setShowAuthModal(true)} />

      <section className="py-14 px-4">
        <div className="max-w-5xl mx-auto text-center mb-10">
          <h1 className="text-3xl font-bold mb-2">Simple, usage-based pricing</h1>
          <p className="text-muted-foreground">
            Pay for what you clip. Upgrade or cancel anytime.
          </p>
        </div>

        {error && (
          <p className="max-w-md mx-auto text-center text-sm text-destructive mb-6">
            {error}
          </p>
        )}

        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLAN_CARDS.map((plan) => {
            const isCurrentPlan = quota?.plan_tier === plan.tier;
            return (
              <Card
                key={plan.tier}
                className={plan.highlighted ? "border-primary shadow-md relative" : "relative"}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                )}
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>
                    <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-sm">{plan.cadence}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="font-medium">{plan.attempts}</p>
                  <ul className="space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 text-primary shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  {plan.tier === "free" ? (
                    <Button variant="outline" className="w-full" disabled>
                      {isCurrentPlan ? "Current Plan" : "Included"}
                    </Button>
                  ) : (
                    (() => {
                      const tier = plan.tier;
                      return (
                        <Button
                          className="w-full"
                          variant={plan.highlighted ? "default" : "outline"}
                          disabled={isCurrentPlan || checkoutLoading === tier}
                          onClick={() => handleUpgrade(tier)}
                        >
                          {isCurrentPlan
                            ? "Current Plan"
                            : checkoutLoading === tier
                            ? "Redirecting..."
                            : `Upgrade to ${plan.name}`}
                        </Button>
                      );
                    })()
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
