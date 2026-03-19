"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LogOut,
  User,
  ArrowRight,
  LayoutDashboard,
  Video,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/contexts/auth-context";

interface NavbarProps {
  onSignInClick?: () => void;
}

export function Navbar({ onSignInClick }: NavbarProps) {
  const { user, signOut, loading: authLoading } = useAuth();
  const pathname = usePathname();

  const navLinks = [
    { href: "/?new=1", label: "Upload Video", icon: Video, match: "/" },
    { href: "/dashboard", label: "My Videos", icon: LayoutDashboard, match: "/dashboard" },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between max-w-7xl">

        {/* Left: hamburger (when signed in) + logo */}
        <div className="flex items-center gap-2">
          {!authLoading && user && (
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  aria-label="Open menu"
                  className="w-[44px] h-[44px] p-0 flex items-center justify-center flex-shrink-0"
                >
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>

              {/* Sheet renders in a portal — naturally above the navbar */}
              <SheetContent side="left" className="w-72 p-0 flex flex-col">
                <SheetHeader className="border-b px-5 py-5 flex-shrink-0">
                  <SheetTitle className="sr-only">Navigation</SheetTitle>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{user.email}</p>
                      <p className="text-xs text-muted-foreground">Signed in</p>
                    </div>
                  </div>
                </SheetHeader>

                <div className="flex flex-col gap-1 px-3 py-4 flex-1">
                  {navLinks.map(({ href, label, icon: Icon, match }) => {
                    const active = pathname === match;
                    return (
                      <SheetClose asChild key={href}>
                        <Link
                          href={href}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                            active
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          {label}
                        </Link>
                      </SheetClose>
                    );
                  })}
                </div>

                <div className="border-t px-3 py-4 flex-shrink-0">
                  <button
                    onClick={() => signOut()}
                    className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/5 hover:text-destructive transition-colors"
                  >
                    <LogOut className="w-4 h-4 flex-shrink-0" />
                    Sign Out
                  </button>
                </div>
              </SheetContent>
            </Sheet>
          )}

          <Link href="/" className="flex items-center">
            <Image src="/logo.svg" alt="AM Logo" width={56} height={37} priority />
          </Link>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {!authLoading && !user && (
            <Button size="sm" onClick={onSignInClick}>
              Get Started
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
