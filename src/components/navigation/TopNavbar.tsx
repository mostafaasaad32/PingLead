"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Radar,
  LayoutDashboard,
  Filter,
  FileText,
  Briefcase,
  BarChart3,
  User,
  Bell,
  CreditCard,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface UserProfileState {
  fullName: string;
  email: string;
  credits: number;
}

export default function TopNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [userProfile, setUserProfile] = useState<UserProfileState>({
    fullName: "مستقل",
    email: "",
    credits: 25,
  });
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch real authenticated user profile & credits from Supabase
  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const userEmail = user.email || "";
      const defaultName =
        user.user_metadata?.full_name || userEmail.split("@")[0] || "مستقل";

      // Query real profile from Supabase freelancer_profiles
      const { data: profile } = await (supabase
        .from("freelancer_profiles") as any)
        .select("full_name, ai_credits")
        .eq("user_id", user.id)
        .maybeSingle();

      const profileData = profile as { full_name: string | null; ai_credits: number | null } | null;

      if (isMounted) {
        setUserProfile({
          fullName: profileData?.full_name || defaultName,
          email: userEmail,
          credits: profileData?.ai_credits ?? 25,
        });
      }
    }

    loadUser();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadUser();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const handleSignOut = async () => {
    setDropdownOpen(false);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const navLinks = [
    {
      name: "Dashboard",
      labelAr: "لوحة التحكم",
      href: "/dashboard",
      icon: LayoutDashboard,
      isActive: pathname === "/dashboard" || pathname.startsWith("/dashboard/"),
    },
    {
      name: "Job Filters",
      labelAr: "فلاتر المشاريع",
      href: "/filters",
      icon: Filter,
      isActive: pathname.startsWith("/filters"),
    },
    {
      name: "Proposal Templates",
      labelAr: "قوالب العروض",
      href: "/templates",
      icon: FileText,
      isActive: pathname.startsWith("/templates"),
    },
    {
      name: "AI Portfolio",
      labelAr: "مخزن الأعمال الذكي",
      href: "/portfolio",
      icon: Briefcase,
      isActive: pathname.startsWith("/portfolio"),
    },
    {
      name: "Profile Audit",
      labelAr: "تقييم البروفايل",
      href: "/profile-audit",
      icon: Sparkles,
      isActive: pathname.startsWith("/profile-audit"),
    },
    {
      name: "Insights",
      labelAr: "التحليلات والمتابعة",
      href: "/insights",
      icon: BarChart3,
      isActive: pathname.startsWith("/insights") || pathname.startsWith("/tracker"),
    },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200/80 shadow-2xs">
      <div className="w-full max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="w-full flex justify-between items-center h-12">
          {/* Right/Start Section: Logo & Main Compact Navigation Tabs */}
          <div className="flex items-center gap-5 lg:gap-6">
            {/* Logo */}
            <Link
              href="/dashboard"
              className="flex items-center gap-2 group transition shrink-0"
            >
              <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center text-emerald-400 shadow-2xs group-hover:scale-105 transition-transform duration-200">
                <Radar className="w-4 h-4 text-emerald-400 group-hover:rotate-12 transition-transform duration-300" />
              </div>
              <span className="font-extrabold text-base tracking-tight text-slate-900 flex items-center gap-1.5">
                PingLead
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  Beta
                </span>
              </span>
            </Link>

            {/* Desktop Navigation Links (High-Density Compact) */}
            <nav className="hidden md:flex items-center gap-4 lg:gap-5">
              {navLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative inline-flex items-center gap-1.5 py-1 px-1 text-[13px] font-medium transition-colors duration-150 rounded whitespace-nowrap ${
                      item.isActive
                        ? "text-slate-900 font-semibold"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    <Icon
                      className={`w-3.5 h-3.5 ${
                        item.isActive ? "text-emerald-600" : "text-slate-400"
                      }`}
                    />
                    <span>{item.labelAr}</span>
                    {/* Active Underline Indicator positioned on the bottom border */}
                    {item.isActive && (
                      <span className="absolute bottom-[-13px] left-0 right-0 h-[2px] bg-emerald-600 rounded-full" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Left/End Section: AI Credits Badge & Profile Dropdown */}
          <div className="flex items-center gap-2.5">
            {/* Credits Badge: Flat, sleek Vollna-style indicator */}
            <Link
              href="/settings/subscription"
              title="رصيد توليد عروض الـ AI المتبقي - اضغط للترقية وشحن الرصيد"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50/80 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60 text-xs font-medium transition shadow-2xs"
            >
              <span>⚡ {userProfile.credits} نقطة AI</span>
            </Link>

            {/* Account Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="h-8 px-2.5 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition text-slate-700 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <div className="w-5 h-5 rounded-md bg-slate-900 text-emerald-400 flex items-center justify-center font-bold text-[10px] uppercase shrink-0">
                  {userProfile.fullName ? userProfile.fullName[0] : "U"}
                </div>
                <span className="hidden sm:inline max-w-[110px] truncate text-slate-800 font-medium" dir="ltr">
                  {userProfile.fullName}
                </span>
                <ChevronDown
                  className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${
                    dropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div className="absolute left-0 mt-2 w-56 rounded-2xl bg-white border border-slate-200 shadow-xl py-2 z-50 text-right animate-in fade-in slide-in-from-top-2 duration-150">
                  {/* User Info Header */}
                  <div className="px-4 py-2.5 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {userProfile.fullName}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate font-mono mt-0.5 dir-ltr text-right">
                      {userProfile.email}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md w-fit">
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                      <span>{userProfile.credits} رصيد AI متاح</span>
                    </div>
                  </div>

                  {/* Vollna Settings Submenu Links */}
                  <div className="py-1">
                    <Link
                      href="/settings/profile"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition"
                    >
                      <User className="w-4 h-4 text-slate-400" />
                      <span>الملف الشخصي</span>
                    </Link>

                    <Link
                      href="/settings/notifications"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition"
                    >
                      <Bell className="w-4 h-4 text-slate-400" />
                      <span>إشعارات وتنبيهات تليجرام</span>
                    </Link>

                    <Link
                      href="/settings/subscription"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition"
                    >
                      <CreditCard className="w-4 h-4 text-slate-400" />
                      <span>إدارة الباقة والاشتراك</span>
                    </Link>
                  </div>

                  <div className="border-t border-slate-100 my-1" />

                  {/* Sign Out */}
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-red-600 hover:bg-red-50 transition font-semibold"
                  >
                    <LogOut className="w-4 h-4 text-red-500" />
                    <span>تسجيل الخروج</span>
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Menu Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
              aria-label="تبديل القائمة"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1">
          {navLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                  item.isActive
                    ? "bg-emerald-50 text-emerald-800 font-bold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    item.isActive ? "text-emerald-600" : "text-slate-400"
                  }`}
                />
                <span className="font-bold">{item.labelAr}</span>
              </Link>
            );
          })}

          <div className="border-t border-slate-100 pt-2 mt-2">
            <Link
              href="/settings/profile"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-slate-700 hover:bg-slate-50"
            >
              <User className="w-4 h-4 text-slate-400" />
              <span>إعدادات الحساب</span>
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-red-600 hover:bg-red-50 text-right"
            >
              <LogOut className="w-4 h-4 text-red-500" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
