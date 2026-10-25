// ==============================================================================
// src/app/(dashboard)/layout.tsx
// Vollna-Style Responsive Dashboard Layout with Master Top Navbar
// ==============================================================================

import TopNavbar from "@/components/navigation/TopNavbar";
import FeedbackButton from "@/components/feedback/FeedbackButton";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Master Top Navigation Bar (Vollna Layout) */}
      <TopNavbar />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>

      {/* Beta feedback ("رأيك") */}
      <FeedbackButton />

      {/* Clean Vollna-style Footer */}
      <footer className="border-t border-slate-200/80 bg-white py-6 mt-auto">
        <div className="w-full max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">PingLead</span>
            <span>&copy; {new Date().getFullYear()} — منصة اصطياد المشاريع الذكية وتوليد العروض</span>
          </div>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5 text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/50">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              9 منصات متصلة بالرادار
            </span>
            <a
              href="https://t.me/Ping_Lead22_bot"
              target="_blank"
              rel="noreferrer"
              className="hover:text-emerald-600 transition"
            >
              تليجرام بوت
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
