"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, Bell, CreditCard, ShieldCheck } from "lucide-react";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navItems = [
    {
      name: "My Profile",
      labelAr: "الملف الشخصي",
      description: "البيانات الشخصية، النبذة، والمنطقة الزمنية",
      href: "/settings/profile",
      icon: User,
      isActive:
        pathname === "/settings/profile" ||
        pathname === "/settings" ||
        pathname === "/settings/",
    },
    {
      name: "Notifications",
      labelAr: "إشعارات تليجرام",
      description: "ربط البوت والتنبيهات اللحظية للمشاريع",
      href: "/settings/notifications",
      icon: Bell,
      isActive: pathname.startsWith("/settings/notifications"),
    },
    {
      name: "Manage Subscription",
      labelAr: "إدارة الباقة والاشتراك",
      description: "شحن الرصيد والترقية والخطط المتاحة",
      href: "/settings/subscription",
      icon: CreditCard,
      isActive: pathname.startsWith("/settings/subscription"),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          إعدادات الحساب والمنصة
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          تحكم في بياناتك الشخصية، ربط تنبيهات تليجرام الفورية، وإدارة رصيد الذكاء الاصطناعي وباقات الاشتراك.
        </p>
      </div>

      {/* Main Grid: Vollna Sub-Sidebar + Content Area */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Settings Sub-Sidebar (Right side in RTL) */}
        <aside className="md:col-span-4 lg:col-span-3">
          <div className="vollna-card p-2 sm:p-3 bg-white border border-slate-200 rounded-2xl shadow-xs sticky top-20">
            <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition whitespace-nowrap md:whitespace-normal ${
                      item.isActive
                        ? "bg-emerald-50 text-emerald-900 border border-emerald-200/70 shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        item.isActive
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="hidden sm:block text-right">
                      <div className="text-xs font-bold leading-tight">
                        {item.labelAr}
                      </div>
                      <div className="text-[11px] font-normal text-slate-500 mt-0.5">
                        {item.description}
                      </div>
                    </div>
                    <span className="sm:hidden text-xs">{item.labelAr}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Quick Security Badge in Sidebar */}
            <div className="hidden md:flex items-center gap-2 mt-4 pt-3 border-t border-slate-100 px-3 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>اتصال آمن ومشفر 100%</span>
            </div>
          </div>
        </aside>

        {/* Content Pane */}
        <section className="md:col-span-8 lg:col-span-9">
          {children}
        </section>
      </div>
    </div>
  );
}
