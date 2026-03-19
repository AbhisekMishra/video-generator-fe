"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LogOut,
  User,
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

export function NavDrawer() {
  const { user, signOut, loading: authLoading } = useAuth();
  const pathname = usePathname();

  if (authLoading || !user) return null;

  const navLinks = [
    { href: "/?new=1", label: "Upload Video", icon: Video, match: "/" },
    { href: "/dashboard", label: "My Videos", icon: LayoutDashboard, match: "/dashboard" },
  ];

  return (
    <div className="fixed top-0 left-0 z-[49] flex items-center justify-center p-2">
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            aria-label="Open menu"
            className="min-w-[44px] min-h-[44px] p-0 rounded-lg hover:bg-accent"
          >
            <Menu className="w-5 h-5" />
          </Button>
        </SheetTrigger>

        <SheetContent side="left" className="w-72 p-0 flex flex-col">
          {/* Drawer header */}
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

          {/* Nav links */}
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

          {/* Sign out */}
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
    </div>
  );
}
