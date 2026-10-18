import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PingLead | منصة رادار واصطياد مشاريع العمل الحر الذكية",
  description: "الرادار الذكي لمتابعة واصطياد مشاريع العمل الحر من 9 منصات عربية وعالمية مع توليد عروض ذكية ومطابقة فورية",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-[#F8FAFC] text-[#0F172A] antialiased min-h-screen selection:bg-emerald-100 selection:text-emerald-800">
        {children}
      </body>
    </html>
  );
}
