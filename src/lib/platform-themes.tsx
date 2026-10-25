import React from "react";

export interface PlatformThemeConfig {
  id: string;
  nameAr: string;
  nameEn: string;
  domain: string;
  region: "arab" | "global";
  tagline: string;
  brandHex: string;
  // Visual classes
  topStripeGradient: string;
  cardBorder: string;
  cardHoverBorder: string;
  cardGlow: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  badgeDomainBg: string;
  titleHover: string;
  openBtnClass: string;
  logoBg: string;
}

export const PLATFORM_THEMES: Record<string, PlatformThemeConfig> = {
  mostaql: {
    id: "mostaql",
    nameAr: "مستقل",
    nameEn: "Mostaql",
    domain: "mostaql.com",
    region: "arab",
    tagline: "أكبر منصة عمل حر عربية",
    brandHex: "#0284c7",
    topStripeGradient: "from-sky-500 via-sky-400 to-blue-600",
    cardBorder: "border-sky-100/90",
    cardHoverBorder: "hover:border-sky-400",
    cardGlow: "hover:shadow-sky-100/70",
    badgeBg: "bg-sky-50 text-sky-950",
    badgeText: "text-sky-900",
    badgeBorder: "border-sky-200/80",
    badgeDomainBg: "bg-sky-100 text-sky-700",
    titleHover: "hover:text-sky-700",
    openBtnClass: "hover:bg-sky-50 hover:text-sky-700 hover:border-sky-300 text-slate-700 border-slate-200",
    logoBg: "bg-[#0284c7]",
  },
  nafezly: {
    id: "nafezly",
    nameAr: "نفذلي",
    nameEn: "Nafezly",
    domain: "nafezly.com",
    region: "arab",
    tagline: "منصة العمل الحر العربية",
    brandHex: "#4f46e5",
    topStripeGradient: "from-indigo-600 via-indigo-500 to-violet-600",
    cardBorder: "border-indigo-100/90",
    cardHoverBorder: "hover:border-indigo-400",
    cardGlow: "hover:shadow-indigo-100/70",
    badgeBg: "bg-indigo-50 text-indigo-950",
    badgeText: "text-indigo-900",
    badgeBorder: "border-indigo-200/80",
    badgeDomainBg: "bg-indigo-100 text-indigo-700",
    titleHover: "hover:text-indigo-700",
    openBtnClass: "hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 text-slate-700 border-slate-200",
    logoBg: "bg-[#4f46e5]",
  },
  khamsat: {
    id: "khamsat",
    nameAr: "خمسات",
    nameEn: "Khamsat",
    domain: "khamsat.com",
    region: "arab",
    tagline: "سوق الخدمات المصغرة العربية",
    brandHex: "#16a34a",
    topStripeGradient: "from-emerald-500 via-green-500 to-teal-600",
    cardBorder: "border-emerald-100/90",
    cardHoverBorder: "hover:border-emerald-400",
    cardGlow: "hover:shadow-emerald-100/70",
    badgeBg: "bg-emerald-50 text-emerald-950",
    badgeText: "text-emerald-900",
    badgeBorder: "border-emerald-200/80",
    badgeDomainBg: "bg-emerald-100 text-emerald-700",
    titleHover: "hover:text-emerald-700",
    openBtnClass: "hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 text-slate-700 border-slate-200",
    logoBg: "bg-[#16a34a]",
  },
  kafiil: {
    id: "kafiil",
    nameAr: "كفيل",
    nameEn: "Kafiil",
    domain: "kafiil.com",
    region: "arab",
    tagline: "منصة العمل والخدمات المصغرة",
    brandHex: "#d97706",
    topStripeGradient: "from-amber-500 via-amber-400 to-orange-500",
    cardBorder: "border-amber-100/90",
    cardHoverBorder: "hover:border-amber-400",
    cardGlow: "hover:shadow-amber-100/70",
    badgeBg: "bg-amber-50 text-amber-950",
    badgeText: "text-amber-900",
    badgeBorder: "border-amber-200/80",
    badgeDomainBg: "bg-amber-100 text-amber-800",
    titleHover: "hover:text-amber-700",
    openBtnClass: "hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300 text-slate-700 border-slate-200",
    logoBg: "bg-[#d97706]",
  },
  baeed: {
    id: "baeed",
    nameAr: "بعيد",
    nameEn: "Baeed",
    domain: "baeed.com",
    region: "arab",
    tagline: "بوابة التوظيف والعمل عن بعد",
    brandHex: "#0d9488",
    topStripeGradient: "from-teal-500 via-teal-400 to-emerald-600",
    cardBorder: "border-teal-100/90",
    cardHoverBorder: "hover:border-teal-400",
    cardGlow: "hover:shadow-teal-100/70",
    badgeBg: "bg-teal-50 text-teal-950",
    badgeText: "text-teal-900",
    badgeBorder: "border-teal-200/80",
    badgeDomainBg: "bg-teal-100 text-teal-700",
    titleHover: "hover:text-teal-700",
    openBtnClass: "hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300 text-slate-700 border-slate-200",
    logoBg: "bg-[#0d9488]",
  },
  freelancer: {
    id: "freelancer",
    nameAr: "فريلانسر",
    nameEn: "Freelancer",
    domain: "freelancer.com",
    region: "global",
    tagline: "أضخم منصة عمل حر دولية",
    brandHex: "#007fed",
    topStripeGradient: "from-sky-400 via-blue-500 to-indigo-600",
    cardBorder: "border-blue-100/90",
    cardHoverBorder: "hover:border-blue-400",
    cardGlow: "hover:shadow-blue-100/70",
    badgeBg: "bg-blue-50 text-blue-950",
    badgeText: "text-blue-900",
    badgeBorder: "border-blue-200/80",
    badgeDomainBg: "bg-blue-100 text-blue-700",
    titleHover: "hover:text-blue-700",
    openBtnClass: "hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 text-slate-700 border-slate-200",
    logoBg: "bg-[#007fed]",
  },
  pph: {
    id: "pph",
    nameAr: "بيبول بير أور",
    nameEn: "PeoplePerHour",
    domain: "peopleperhour.com",
    region: "global",
    tagline: "سوق العمل بالساعة للمحترفين",
    brandHex: "#ea580c",
    topStripeGradient: "from-orange-500 via-amber-500 to-orange-600",
    cardBorder: "border-orange-100/90",
    cardHoverBorder: "hover:border-orange-400",
    cardGlow: "hover:shadow-orange-100/70",
    badgeBg: "bg-orange-50 text-orange-950",
    badgeText: "text-orange-900",
    badgeBorder: "border-orange-200/80",
    badgeDomainBg: "bg-orange-100 text-orange-700",
    titleHover: "hover:text-orange-700",
    openBtnClass: "hover:bg-orange-50 hover:text-orange-700 hover:border-orange-300 text-slate-700 border-slate-200",
    logoBg: "bg-[#ea580c]",
  },
  remoteok: {
    id: "remoteok",
    nameAr: "ريموت أوك",
    nameEn: "RemoteOK",
    domain: "remoteok.com",
    region: "global",
    tagline: "أكبر لوحة وظائف عن بعد عالمياً",
    brandHex: "#e11d48",
    topStripeGradient: "from-rose-500 via-pink-500 to-red-600",
    cardBorder: "border-rose-100/90",
    cardHoverBorder: "hover:border-rose-400",
    cardGlow: "hover:shadow-rose-100/70",
    badgeBg: "bg-rose-50 text-rose-950",
    badgeText: "text-rose-900",
    badgeBorder: "border-rose-200/80",
    badgeDomainBg: "bg-rose-100 text-rose-700",
    titleHover: "hover:text-rose-700",
    openBtnClass: "hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 text-slate-700 border-slate-200",
    logoBg: "bg-[#e11d48]",
  },
  wwr: {
    id: "wwr",
    nameAr: "وي وورك ريموتلي",
    nameEn: "WeWorkRemotely",
    domain: "weworkremotely.com",
    region: "global",
    tagline: "مجتمع الوظائف عن بعد الأشهر",
    brandHex: "#dc2626",
    topStripeGradient: "from-red-600 via-rose-600 to-red-700",
    cardBorder: "border-red-100/90",
    cardHoverBorder: "hover:border-red-400",
    cardGlow: "hover:shadow-red-100/70",
    badgeBg: "bg-red-50 text-red-950",
    badgeText: "text-red-900",
    badgeBorder: "border-red-200/80",
    badgeDomainBg: "bg-red-100 text-red-700",
    titleHover: "hover:text-red-700",
    openBtnClass: "hover:bg-red-50 hover:text-red-700 hover:border-red-300 text-slate-700 border-slate-200",
    logoBg: "bg-[#dc2626]",
  },
  upwork: {
    id: "upwork",
    nameAr: "أب وورك",
    nameEn: "Upwork",
    domain: "upwork.com",
    region: "global",
    tagline: "أكبر منصة عمل حر للمحترفين دولياً",
    brandHex: "#14a800",
    topStripeGradient: "from-emerald-600 via-green-500 to-teal-600",
    cardBorder: "border-emerald-100/90",
    cardHoverBorder: "hover:border-emerald-400",
    cardGlow: "hover:shadow-emerald-100/70",
    badgeBg: "bg-emerald-50 text-emerald-950",
    badgeText: "text-emerald-900",
    badgeBorder: "border-emerald-200/80",
    badgeDomainBg: "bg-emerald-100 text-emerald-700",
    titleHover: "hover:text-emerald-700",
    openBtnClass: "hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 text-slate-700 border-slate-200",
    logoBg: "bg-[#14a800]",
  },
  reddit: {
    id: "reddit",
    nameAr: "ريديت",
    nameEn: "Reddit",
    domain: "reddit.com",
    region: "global",
    tagline: "مجتمعات التوظيف والعمل الحر",
    brandHex: "#ff4500",
    topStripeGradient: "from-orange-600 via-red-500 to-orange-700",
    cardBorder: "border-orange-100/90",
    cardHoverBorder: "hover:border-orange-400",
    cardGlow: "hover:shadow-orange-100/70",
    badgeBg: "bg-orange-50 text-orange-950",
    badgeText: "text-orange-900",
    badgeBorder: "border-orange-200/80",
    badgeDomainBg: "bg-orange-100 text-orange-700",
    titleHover: "hover:text-orange-700",
    openBtnClass: "hover:bg-orange-50 hover:text-orange-700 hover:border-orange-300 text-slate-700 border-slate-200",
    logoBg: "bg-[#ff4500]",
  },
  default: {
    id: "default",
    nameAr: "منصة عمل حر",
    nameEn: "Marketplace",
    domain: "freelance",
    region: "global",
    tagline: "فرصة عمل حر معتمدة",
    brandHex: "#059669",
    topStripeGradient: "from-emerald-500 via-teal-500 to-emerald-600",
    cardBorder: "border-slate-200",
    cardHoverBorder: "hover:border-emerald-400",
    cardGlow: "hover:shadow-slate-200/70",
    badgeBg: "bg-slate-100 text-slate-900",
    badgeText: "text-slate-800",
    badgeBorder: "border-slate-200",
    badgeDomainBg: "bg-slate-200 text-slate-700",
    titleHover: "hover:text-emerald-700",
    openBtnClass: "hover:bg-slate-100 text-slate-700 border-slate-200",
    logoBg: "bg-slate-800",
  },
};

export function getPlatformTheme(platform?: string | null): PlatformThemeConfig {
  if (!platform) return PLATFORM_THEMES.default;
  const key = platform.trim().toLowerCase();
  return (
    PLATFORM_THEMES[key] || {
      ...PLATFORM_THEMES.default,
      id: key,
      nameAr: key.toUpperCase(),
      nameEn: key,
      domain: `${key}.com`,
    }
  );
}

/**
 * High-definition Vector Brand Logo for each supported platform.
 * Sharp, lightweight inline SVG with no external network requests.
 */
export function PlatformLogo({
  platform,
  size = 20,
  className = "",
}: {
  platform?: string | null;
  size?: number | string;
  className?: string;
}) {
  const p = (platform || "").trim().toLowerCase();

  if (p === "mostaql") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="Mostaql"
      >
        <rect width="32" height="32" rx="7" fill="#0284C7" />
        <path
          d="M8 22V11.5L13 16.5L16 13.5L19 16.5L24 11.5V22"
          stroke="#FFFFFF"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="16" cy="9.5" r="1.8" fill="#7DD3FC" />
      </svg>
    );
  }

  if (p === "nafezly") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="Nafezly"
      >
        <rect width="32" height="32" rx="7" fill="#4F46E5" />
        <path
          d="M9 22V10L23 22V10"
          stroke="#FFFFFF"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="23" cy="9.5" r="2" fill="#C7D2FE" />
      </svg>
    );
  }

  if (p === "khamsat") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="Khamsat"
      >
        <rect width="32" height="32" rx="7" fill="#16A34A" />
        <path
          d="M10 9H22L19.5 15H13.5C17.5 15 21 16.5 21 20C21 23 17 24.5 12 24"
          stroke="#FFFFFF"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="21" cy="9" r="1.5" fill="#86EFAC" />
      </svg>
    );
  }

  if (p === "kafiil") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="Kafiil"
      >
        <rect width="32" height="32" rx="7" fill="#D97706" />
        <path
          d="M16 6.5L8.5 10V15.5C8.5 20.8 11.8 24.8 16 26C20.2 24.8 23.5 20.8 23.5 15.5V10L16 6.5Z"
          fill="#F59E0B"
          stroke="#FFFFFF"
          strokeWidth="1.6"
        />
        <path
          d="M12.5 16L15 18.5L19.5 13.5"
          stroke="#FFFFFF"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (p === "baeed") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="Baeed"
      >
        <rect width="32" height="32" rx="7" fill="#0D9488" />
        <path
          d="M7.5 16L24.5 8L18 24.5L14.5 18L7.5 16Z"
          fill="#14B8A6"
          stroke="#FFFFFF"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M14.5 18L24.5 8"
          stroke="#FFFFFF"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (p === "freelancer") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="Freelancer.com"
      >
        <rect width="32" height="32" rx="7" fill="#007FED" />
        <path d="M7 22L13.5 9L18 15.5L25 10L21.5 22H7Z" fill="#29B2FE" />
        <path d="M13.5 9L18 15.5L25 10L20.5 22L13.5 9Z" fill="#FFFFFF" />
        <path d="M7 22L13.5 9L15 17.5L7 22Z" fill="#005CB0" />
      </svg>
    );
  }

  if (p === "pph") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="PeoplePerHour"
      >
        <rect width="32" height="32" rx="7" fill="#FF6900" />
        <circle cx="16" cy="16" r="9.5" stroke="#FFFFFF" strokeWidth="2.4" />
        <path
          d="M12 21V11.5H16C18 11.5 19.5 12.5 19.5 14.5C19.5 16.5 18 17.5 16 17.5H12"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (p === "remoteok") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="RemoteOK"
      >
        <rect width="32" height="32" rx="7" fill="#FF4742" />
        <rect
          x="6.5"
          y="6.5"
          width="19"
          height="19"
          rx="5"
          stroke="#FFFFFF"
          strokeWidth="2.2"
        />
        <text
          x="16"
          y="20.5"
          fill="#FFFFFF"
          fontSize="11.5"
          fontWeight="900"
          fontFamily="system-ui, -apple-system, sans-serif"
          textAnchor="middle"
        >
          OK
        </text>
      </svg>
    );
  }

  if (p === "wwr") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="WeWorkRemotely"
      >
        <rect width="32" height="32" rx="7" fill="#DC2626" />
        <path
          d="M6 11.5L9.5 21L12.5 14.5L15.5 21L19 11.5M13 11.5L16.5 21L19.5 14.5L22.5 21L26 11.5"
          stroke="#FFFFFF"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Platform"
    >
      <rect width="32" height="32" rx="7" fill="#334155" />
      <circle cx="16" cy="16" r="8" stroke="#FFFFFF" strokeWidth="2" />
      <ellipse cx="16" cy="16" rx="4" ry="8" stroke="#FFFFFF" strokeWidth="1.5" />
      <line x1="8" y1="16" x2="24" y2="16" stroke="#FFFFFF" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * Beautifully stylized, source-attributed Platform Badge with Logo.
 */
export function PlatformBadge({
  platform,
  showDomain = true,
  className = "",
}: {
  platform?: string | null;
  showDomain?: boolean;
  className?: string;
}) {
  const theme = getPlatformTheme(platform);

  return (
    <div
      className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-md border shadow-2xs font-medium text-[11px] transition-all ${theme.badgeBg} ${theme.badgeBorder} ${className}`}
      title={`${theme.nameAr} (${theme.nameEn}) - ${theme.tagline}`}
    >
      <PlatformLogo platform={theme.id} size={13} className="shrink-0 drop-shadow-xs" />
      <span className={theme.badgeText}>{theme.nameAr}</span>
      {showDomain && (
        <span
          className={`text-[9.5px] font-mono px-1 py-0.2 rounded ${theme.badgeDomainBg} opacity-90`}
          dir="ltr"
        >
          {theme.domain}
        </span>
      )}
    </div>
  );
}
