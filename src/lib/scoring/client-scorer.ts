// ==============================================================================
// src/lib/scoring/client-scorer.ts
// Client Scoring & Risk Radar Engine (رادار تقييم العميل وكشف المخاطر)
// Modeled after Upwex analytics: Instant heuristic scoring with $0 AI Cost.
// Works seamlessly across Arabic platforms (Mostaql, Nafezly, Khamsat)
// and Global platforms (Upwork, Freelancer, PeoplePerHour, Guru).
// ==============================================================================

export interface ClientMetricChip {
  label: string; // تسمية المؤشر (مثلاً: "معدل التوظيف", "شارة التوثيق")
  value: string; // القيمة (مثلاً: "70%", "موثق ومعتمد")
  subtext?: string; // نص توضيحي مقتضب أسفل القيمة
  tone: "positive" | "neutral" | "warning" | "accent";
  icon?: string; // أيقونة تعبيرية
}

export interface ClientEvaluation {
  score: number | null; // من 0 إلى 10 (مثلاً 8.5) أو null إذا غير متوفر
  hideClientBadge?: boolean; // إخفاء الشارة تماماً إذا كانت البيانات غير متوفرة (مثل خمسات)
  isCorporateJob?: boolean; // وظيفة شركة عن بعد (مثل بعيد، RemoteOK، WWR)
  badge: "excellent" | "good" | "warning" | "high_risk" | "corporate" | "none";
  labelAr: string; // مثلاً: "عميل ممتاز - يوظف بانتظام" أو "وظيفة شركة عن بعد"
  hireRate?: number; // نسبة التوظيف %
  totalSpent?: string; // إجمالي الإنفاق
  paymentVerified: boolean;
  clientRating?: number; // من 5
  clientCountry?: string; // بلد صاحب المشروع إن وجد
  openProjects?: number; // عدد المشاريع المفتوحة
  inProgressProjects?: number; // عدد المشاريع قيد التنفيذ
  clientProfession?: string; // مهنة أو تخصص العميل إن وجد (مثل نفذلي)
  platform?: string; // معرف المنصة
  metricsChips?: ClientMetricChip[]; // كروت المؤشرات المتكيفة تلقائياً مع المنصة
  redFlags: string[]; // قائمة التحذيرات
  greenFlags: string[]; // قائمة المميزات
  negotiationTipAr?: string; // نصيحة تفاوضية سريعة للفريلانسر
}

export interface ClientJobData {
  platform?: string;
  title?: string;
  description?: string;
  budget?: string | number | null;
  budget_min?: number | null;
  budget_max?: number | null;
  budget_usd_estimate?: number | null;
  currency?: string | null;
  author?: string | null;
  client_profession?: string | null;

  // Direct client fields
  client_hire_rate?: number | null;
  client_open_projects?: number | null;
  client_in_progress?: number | null;
  client_registered_at?: string | null;
  client_country?: string | null;
  client_rating?: number | null;
  payment_verified?: boolean | null;
  total_spent?: string | number | null;
  total_reviews?: number | null;
  client_reviews_count?: number | null;

  // Nested insights (UnifiedProject / public.projects)
  insights?: {
    client_hire_rate?: number | null;
    client_open_projects?: number | null;
    client_in_progress?: number | null;
    client_registered_at?: string | null;
    client_country?: string | null;
    client_profession?: string | null;
    bids_count?: number | null;
    bids_avg?: number | null;
    details_fetched_at?: string | null;
    payment_verified?: boolean | null;
    client_rating?: number | null;
    total_spent?: string | number | null;
    total_reviews?: number | null;
    job_type?: "fixed" | "hourly" | null;
    client_evaluation?: ClientEvaluation | null;
  } | null;

  // Feed/Post text
  post_text?: string;
  url?: string;
  post_url?: string;
}

/**
 * Builds dynamic, platform-aware 4-metric chips representing
 * the actual, verified parameters available on that specific site.
 */
export function buildPlatformMetricsChips(params: {
  platform: string;
  hireRate?: number;
  openProjects?: number;
  inProgressProjects?: number;
  paymentVerified: boolean;
  clientCountry?: string;
  clientProfession?: string;
  clientRating?: number;
  totalSpent?: string;
  score?: number | null;
}): ClientMetricChip[] {
  const p = (params.platform || "").toLowerCase();

  // 1. Mostaql: High fidelity hire rate, in-progress jobs, Hsoub escrow
  if (p.includes("mostaql")) {
    const hasRate = typeof params.hireRate === "number";
    const isHighRate = hasRate && params.hireRate! >= 70;
    const isLowRate = hasRate && params.hireRate! < 25 && params.hireRate! > 0;

    return [
      {
        label: "معدل التوظيف",
        value: hasRate ? `${params.hireRate}%` : "عميل جديد",
        subtext: isHighRate ? "توظيف منتظم وممتاز" : isLowRate ? "توظيف نادر - احذر" : hasRate ? "توظيف مقبول" : "أول مشروع له بمستقل",
        tone: isHighRate ? "positive" : isLowRate ? "warning" : "neutral",
        icon: "📊",
      },
      {
        label: "نشاط المشاريع",
        value:
          typeof params.inProgressProjects === "number" && params.inProgressProjects > 0
            ? `${params.inProgressProjects} قيد التنفيذ`
            : typeof params.openProjects === "number" && params.openProjects > 0
              ? `${params.openProjects} مفتوح`
              : "مشروع فردي",
        subtext:
          typeof params.inProgressProjects === "number" && params.inProgressProjects > 0
            ? "يوظف ويتعاقد بنشاط"
            : "يتلقى العروض الآن",
        tone: typeof params.inProgressProjects === "number" && params.inProgressProjects > 0 ? "positive" : "neutral",
        icon: "🔄",
      },
      {
        label: "توثيق الحساب",
        value: params.paymentVerified ? "هوية موثقة" : "حساب مسجل",
        subtext: "نظام حسوب المالي",
        tone: params.paymentVerified ? "positive" : "neutral",
        icon: params.paymentVerified ? "✅" : "👤",
      },
      {
        label: "حماية الدفع",
        value: "إيداع Escrow إلزامي",
        subtext: "ميزانية مجمدة قبل البدء",
        tone: "positive",
        icon: "🛡️",
      },
    ];
  }

  // 2. Nafezly: Verification badge, profession, country, milestone escrow
  if (p.includes("nafezly")) {
    return [
      {
        label: "توثيق نفذلي",
        value: params.paymentVerified ? "شارة معتمدة" : "حساب مسجل",
        subtext: params.paymentVerified ? "موثق رسمياً بنفذلي" : "ضمان مالي مرحلي",
        tone: params.paymentVerified ? "positive" : "neutral",
        icon: params.paymentVerified ? "🏅" : "👤",
      },
      {
        label: "تخصص العميل",
        value: params.clientProfession || "صاحب عمل",
        subtext: "بروفايل العميل بنفذلي",
        tone: "neutral",
        icon: "💼",
      },
      {
        label: "دولة العميل",
        value: params.clientCountry ? `📍 ${params.clientCountry}` : "الوطن العربي",
        subtext: "الموقع الجغرافي",
        tone: "neutral",
        icon: "🌍",
      },
      {
        label: "حماية الدفع",
        value: "مراحل دفع محمية",
        subtext: "ضمان بنكي عبر نفذلي",
        tone: "positive",
        icon: "🛡️",
      },
    ];
  }

  // 3. Freelancer.com: Escrow project, paid upgrades (featured/urgent), country, competition
  if (p.includes("freelancer")) {
    return [
      {
        label: "حالة الضمان",
        value: params.paymentVerified ? "ترقية مدفوعة / Escrow" : "مشروع قياسي",
        subtext: params.paymentVerified ? "رسوم الترقية مسددة" : "احرص على Milestone",
        tone: params.paymentVerified ? "positive" : "warning",
        icon: params.paymentVerified ? "💎" : "⚡",
      },
      {
        label: "بلد العميل",
        value: params.clientCountry ? `📍 ${params.clientCountry}` : "عميل دولي",
        subtext: "Freelancer Global",
        tone: "neutral",
        icon: "🌐",
      },
      {
        label: "حماية العقد",
        value: "Freelancer Escrow",
        subtext: "دفعات Milestone بنكية",
        tone: "positive",
        icon: "🛡️",
      },
      {
        label: "وتيرة التنافس",
        value: "تنافس دولي سريع",
        subtext: "قدّم حلاً سريعاً ومباشراً",
        tone: "accent",
        icon: "🚀",
      },
    ];
  }

  // 4. Khamsat buyer requests: the buyer pays only when they order a service, nothing is prepaid
  if (p.includes("khamsat")) {
    return [
      {
        label: "نوع الطلب",
        value: "طلب خدمة",
        subtext: "الدفع بيتم لما المشتري يطلب خدمتك",
        tone: "neutral",
        icon: "🛒",
      },
      {
        label: "بيانات المشتري",
        value: "مش متاحة",
        subtext: "خمسات مش بيعرض سجل المشتري في الطلبات",
        tone: "neutral",
        icon: "👤",
      },
    ];
  }

  // 5. Job boards: Baeed, RemoteOK, WWR. They publish no data about the employer.
  if (p.includes("baeed") || p.includes("remoteok") || p.includes("wwr")) {
    return [
      {
        label: "النوع",
        value: "وظيفة",
        subtext: "مش مشروع فريلانس",
        tone: "neutral",
        icon: "💼",
      },
      {
        label: "صاحب العمل",
        value: "مفيش بيانات",
        subtext: "الموقع مش بيعرض سجل الشركة",
        tone: "neutral",
        icon: "🏢",
      },
    ];
  }

  // 6. General fallback (PPH, Guru, Upwork)
  return [
    {
      label: "وسيلة الدفع",
      value: params.paymentVerified ? "موثقة ومعتمدة" : "قيد التأكيد",
      subtext: params.paymentVerified ? "رصيد أو بطاقة معتمدة" : "التزم بالدفع عبر المنصة",
      tone: params.paymentVerified ? "positive" : "warning",
      icon: params.paymentVerified ? "✅" : "⚠️",
    },
    {
      label: "معدل التوظيف",
      value: typeof params.hireRate === "number" ? `${params.hireRate}%` : "غير محدد",
      subtext: typeof params.hireRate === "number" ? "سجل التوظيف السابق" : "حساب جديد أو غير متاح",
      tone: typeof params.hireRate === "number" && params.hireRate >= 50 ? "positive" : "neutral",
      icon: "📊",
    },
    {
      label: "بلد العميل",
      value: params.clientCountry ? `📍 ${params.clientCountry}` : "غير محدد",
      subtext: "الموقع الجغرافي",
      tone: "neutral",
      icon: "🌍",
    },
    {
      label: "نظام الحماية",
      value: "وساطة المنصة",
      subtext: "ضمان حقوق المستقل",
      tone: "positive",
      icon: "🛡️",
    },
  ];
}

/**
 * Calculates a comprehensive 0-10 client score and risk assessment
 * using an objective, platform-aware weighting algorithm with zero AI cost.
 */
export function calculateClientScore(jobData: ClientJobData | any): ClientEvaluation {
  if (!jobData || typeof jobData !== "object") {
    return {
      score: 5.0,
      badge: "warning",
      labelAr: "بيانات العميل غير متوفرة بعد",
      paymentVerified: false,
      redFlags: ["تعذر قراءة بيانات وسجل العميل"],
      greenFlags: [],
      negotiationTipAr: "تأكد من طلب تفاصيل واضحة لنطاق العمل والاتفاق على وسيلة دفع مضمونة عبر المنصة قبل البدء.",
    };
  }

  const redFlags: string[] = [];
  const greenFlags: string[] = [];

  const platform = String(jobData.platform || "").toLowerCase();
  const title = String(jobData.title || extractTitle(jobData.post_text) || "");
  const desc = String(jobData.description || extractDetails(jobData.post_text) || "");
  const combinedText = `${title} ${desc} ${jobData.post_text || ""} ${jobData.author || ""}`.toLowerCase();

  // 1. Extract Core Metrics (Resolving direct or nested insights)
  const rawHireRate =
    jobData.client_hire_rate ??
    jobData.insights?.client_hire_rate ??
    extractHireRateFromText(combinedText);

  const hireRate = typeof rawHireRate === "number" && !isNaN(rawHireRate)
    ? Math.min(100, Math.max(0, Math.round(rawHireRate)))
    : undefined;

  const openProjects =
    jobData.client_open_projects ??
    jobData.insights?.client_open_projects ??
    extractOpenProjectsFromText(combinedText);

  const inProgressProjects =
    jobData.client_in_progress ??
    jobData.insights?.client_in_progress ??
    extractInProgressFromText(combinedText);

  const rawRating =
    jobData.client_rating ??
    jobData.insights?.client_rating ??
    extractRatingFromText(combinedText);

  const clientRating = typeof rawRating === "number" && !isNaN(rawRating)
    ? Math.min(5, Math.max(0, Number(rawRating.toFixed(1))))
    : undefined;

  const rawSpent =
    jobData.total_spent ??
    jobData.insights?.total_spent ??
    extractSpentFromText(combinedText);

  const totalSpent = rawSpent ? formatSpentString(rawSpent) : undefined;

  const paymentVerified = Boolean(
    jobData.payment_verified ??
    jobData.insights?.payment_verified ??
    inferPaymentVerified(combinedText, platform, hireRate)
  );

  const clientCountry =
    jobData.client_country ||
    jobData.insights?.client_country ||
    undefined;

  const clientProfession =
    jobData.client_profession ||
    jobData.insights?.client_profession ||
    extractProfessionFromAuthor(jobData.author) ||
    undefined;

  const durationText = jobData.duration_text || jobData.insights?.duration_text || undefined;
  const bidsCount = typeof jobData.bids_count === "number" ? jobData.bids_count : (typeof jobData.insights?.bids_count === "number" ? jobData.insights.bids_count : null);

  // 2. Base Score Allocation: Starts from 6.0
  let score = 6.0;

  const isCorporatePlatform = platform.includes("baeed") || platform.includes("remoteok") || platform.includes("wwr");
  const isKhamsat = platform.includes("khamsat");
  const isMostaql = platform.includes("mostaql");
  const isNafezly = platform.includes("nafezly");
  const isFreelancer = platform.includes("freelancer");
  const isPph = platform.includes("pph");
  const isKafiil = platform.includes("kafiil");

  // Specific Khamsat handling: No fake numeric score, hide client badge, zero false warnings
  if (isKhamsat) {
    return {
      score: null,
      hideClientBadge: true,
      badge: "none",
      labelAr: "طلب خدمة في خمسات",
      hireRate: undefined,
      totalSpent: undefined,
      paymentVerified: Boolean(jobData.payment_verified ?? jobData.insights?.payment_verified),
      clientCountry: undefined,
      platform: "khamsat",
      metricsChips: buildPlatformMetricsChips({
        platform: "khamsat",
        paymentVerified: Boolean(jobData.payment_verified ?? jobData.insights?.payment_verified),
        score: null,
      }),
      redFlags: [],
      greenFlags: [
        "طلب خدمة في مجتمع خمسات - التعامل والضمان المالي محمي عبر حسوب",
        "المشتري يدفع ويحجز المبلغ عند طلب الخدمة مباشرة"
      ],
      negotiationTipAr: "في خمسات: المشتري يبحث عن خدمة واضحة وجاهزة؛ وضح له بالضبط ما سيحصل عليه بالخدمة الأساسية وسعر التطويرات الإضافية إن لزم."
    };
  }

  // Specific Corporate Job Boards handling: Baeed, RemoteOK, WWR
  if (isCorporatePlatform) {
    return {
      score: null,
      hideClientBadge: false,
      isCorporateJob: true,
      badge: "corporate",
      labelAr: "🏢 وظيفة شركة عن بُعد",
      // Job boards publish nothing about the employer's payment method
      paymentVerified: false,
      clientCountry,
      platform,
      metricsChips: buildPlatformMetricsChips({
        platform,
        paymentVerified: false,
        clientCountry,
        score: null,
      }),
      redFlags: [],
      greenFlags: [
        "وظيفة عن بُعد عند شركة (مش مشروع فريلانس)",
        "التعاقد والراتب يخضع لسياسة الشركة المباشرة"
      ],
      negotiationTipAr: "شركة تبحث عن محترف طويل الأمد؛ ركز في خطابك على سنوات خبرتك ومشاريعك السابقة الموثقة والتزامك بالمواعيد."
    };
  }

  // --- PILLAR 1: PLATFORM FINANCIAL SECURITY & ESCROW ---
  if (isCorporatePlatform) {
    // Job boards publish nothing about the employer: no bonus, and no claims we can't back
    redFlags.push("وظيفة من موقع توظيف: مفيش بيانات عن صاحب العمل، اتأكد من الشركة قبل ما تقدّم");
  } else if (isKhamsat) {
    // Buyer requests are not prepaid: the buyer pays when they order a service
    greenFlags.push("طلب على خمسات: الدفع بيتم ويتحجز في حسوب لما المشتري يطلب خدمتك");
  } else if (isMostaql) {
    score += 1.0; // Hsoub financial escrow protection
    if (hireRate !== undefined) {
      if (hireRate >= 70) {
        score += 2.0;
        greenFlags.push(`معدل توظيف ممتاز على مستقل (+${hireRate}%) - صاحب عمل يوظف بانتظام`);
      } else if (hireRate >= 40) {
        score += 1.0;
        greenFlags.push(`معدل توظيف جيد ومقبول على مستقل (${hireRate}%)`);
      } else if (hireRate > 0 && hireRate < 25) {
        score -= 2.5;
        redFlags.push(`⚠️ خطر تضييع الوقت: العميل ينشر مشاريع ونادراً ما يوظف (معدل توظيف ${hireRate}%)`);
      }
    } else {
      score += 0.5; // clean new opportunity on Mostaql
      greenFlags.push("عميل جديد على منصة مستقل - فرصة جيدة للمنافسة بأسبقية العرض وبناء شراكة أولى");
    }
    if (paymentVerified) {
      score += 0.5;
      greenFlags.push("حساب وهوية موثقة رسمياً لدى إدارة مستقل (حسوب)");
    }
    if (inProgressProjects && inProgressProjects > 0) {
      score += 0.5;
      greenFlags.push(`لديه ${inProgressProjects} مشروع قيد التنفيذ حالياً على مستقل (يوظف ويتعاقد بنشاط)`);
    }
    if (openProjects && openProjects >= 4) {
      score -= 0.5;
      redFlags.push(`العميل لديه ${openProjects} مشاريع مفتوحة بالتزامن على مستقل - احتمال تشتت وتأخر في الاختيار`);
    }
    greenFlags.push("المستحقات محمية بنظام الضمان المالي والإيداع الإلزامي في حسوب قبل بدء العمل");
  } else if (isNafezly) {
    score += 1.0; // Nafezly milestone escrow
    if (clientProfession) {
      greenFlags.push(`تخصص صاحب المشروع في نفذلي: ${clientProfession}`);
      score += 0.5;
    }
    if (clientCountry) {
      score += 0.5;
      greenFlags.push(`صاحب المشروع من: ${clientCountry}`);
    }
    if (paymentVerified) {
      score += 1.5;
      greenFlags.push("حساب وهوية موثقة بشارة الاعتماد الرسمية من منصة نفذلي");
    } else {
      greenFlags.push("حساب مسجل في نفذلي - التعاقد محمي بنظام المراحل والضمان المالي");
    }
    greenFlags.push("المشروع محمي بنظام الضمان المالي ومراحل الدفع المعتمدة في نفذلي");
  } else if (isFreelancer) {
    score += 1.0; // Freelancer escrow
    if (paymentVerified) {
      score += 2.0;
      greenFlags.push("عميل موثق الدفع في Freelancer.com (ترقية معتمدة أو دفعة مقدمة في المشروع)");
    }
    if (clientCountry) {
      score += 0.5;
      greenFlags.push(`عميل دولي من: ${clientCountry}`);
    }
    if (typeof bidsCount === "number" && bidsCount > 0) {
      score += 0.5;
    }
    greenFlags.push("التعاقد خاضع لنظام الحماية والوساطة الدولية في Freelancer.com");
  } else if (isPph) {
    score += 1.0;
    if (clientCountry) {
      score += 0.5;
      greenFlags.push(`العميل من: ${clientCountry}`); // a stated country is not verification
    }
    greenFlags.push("التعاقد خاضع لنظام الحماية والإيداع البنكي المعتمد في PeoplePerHour");
  } else if (isKafiil) {
    score += 1.0;
    greenFlags.push("مشروع عمل حر محمي بنظام الوساطة والضمان المالي لمنصة كفيل");
  } else {
    // General fallback
    score += 1.0;
    if (hireRate !== undefined) {
      if (hireRate >= 70) score += 2.0;
      else if (hireRate >= 40) score += 1.0;
      else if (hireRate < 25) score -= 2.0;
    }
    if (paymentVerified) score += 1.0;
  }

  // --- PILLAR 2: DESCRIPTION & CLARITY OF SCOPE ---
  const descLength = desc.trim().length;
  if (descLength >= 300) {
    score += 1.0;
    greenFlags.push("وصف تفصيلي واضح وشامل للمتطلبات ونطاق العمل");
  } else if (descLength >= 100) {
    score += 0.5;
    greenFlags.push("وصف محدد ومفهوم لمتطلبات المشروع");
  } else if (descLength > 0 && descLength < 60 && !isKhamsat) {
    // Khamsat requests are one-liners by design: shortness says nothing about the buyer there
    score -= 1.5;
    redFlags.push("وصف المشروع مبهم جداً وقصير للغاية وقد يدل على عميل غير جاد");
  }

  // Duration timeframe specified
  if (durationText) {
    score += 0.5;
    greenFlags.push(`مدة التنفيذ محددة بوضوح (${durationText})`);
  }

  // --- PILLAR 3: BUDGET FAIRNESS & TRANSPARENCY ---
  const budgetUsd = jobData.budget_usd_estimate ?? extractBudgetNumber(jobData.budget);
  const isComplexScope =
    /تطبيق كامل|تطبيق متكامل|ذكاء اصطناعي|full-stack|full stack|متجر إلكتروني شامل|نظام erp|mobile app|saas platform|machine learning|بناء موقع كامل/i.test(
      combinedText
    );

  if (budgetUsd !== null) {
    if (budgetUsd >= 200) {
      score += 1.0;
      greenFlags.push(`ميزانية جيدة ومجزية (${budgetUsd}$) تتناسب مع حجم العمل`);
    } else if (budgetUsd >= 50) {
      score += 0.5;
      greenFlags.push(`الميزانية رصدت بوضوح وتناسب نطاق العمل`);
    }
  } else if (jobData.budget && String(jobData.budget).trim()) {
    score += 0.5;
    greenFlags.push(`الميزانية رصدت بوضوح من صاحب المشروع (${jobData.budget})`);
  }

  if (budgetUsd !== null && budgetUsd < 50 && isComplexScope) {
    score -= 2.0;
    redFlags.push("الميزانية المعروضة لا تتناسب مع حجم العمل المطلوب (ميزانية منخفضة جداً مقابل متطلبات معقدة)");
  }

  // --- PILLAR 4: REPUTATION & INTEGRITY ---
  if (clientRating !== undefined) {
    if (clientRating >= 4.8) {
      score += 0.5;
      greenFlags.push(`تقييم ممتاز من المستقلين السابقين (${clientRating} من 5 ⭐)`);
    } else if (clientRating < 3.5) {
      score -= 1.5;
      redFlags.push(`تقييم العميل السابق منخفض (${clientRating} ⭐) - مشاكل تعاقدية سابقة`);
    }
  }

  // Unpaid samples warning
  if (
    /عينة مجانية|عينه مجانيه|اختبار غير مدفوع|تجربة مجانية|قبل التوظيف صمم|free sample|unpaid test|test task before hiring/i.test(
      combinedText
    )
  ) {
    score -= 2.5;
    redFlags.push("⚠️ تحذير: العميل يشير إلى طلب عينات مجانية أو اختبارات غير مدفوعة");
  }

  // --- GUARANTEE RICH POSITIVE HIGHLIGHTS (Green Flags) ---
  if (descLength >= 60 && !redFlags.some((f) => f.includes("مبهم"))) {
    if (!greenFlags.some((f) => f.includes("وصف"))) {
      greenFlags.push("وصف المشروع مفصل ومحدد بما يكفي لفهم نطاق العمل المطلوب");
    }
  }

  if (jobData.budget && String(jobData.budget).trim() && !redFlags.some((f) => f.includes("الميزانية المعروضة لا تتناسب"))) {
    if (!greenFlags.some((f) => f.includes("الميزانية"))) {
      greenFlags.push(`الميزانية رصدت بوضوح من صاحب المشروع (${jobData.budget})`);
    }
  }

  if (greenFlags.length < 2) {
    greenFlags.push("فرصة تنافسية واعدة لتقديم عرض متميز وبناء سابقة أعمال");
  }

  // 3. Clamping Score: between 1.0 and 10.0 (rounded to 1 decimal place).
  // Without any client history (hire rate or rating) a clear post can't make a client
  // "excellent": the score is capped, so the badge reflects what we actually know.
  const hasHistory = hireRate !== undefined || clientRating !== undefined;
  let finalScore: number | null = null;
  let badge: ClientEvaluation["badge"] = "good";
  let labelAr = "عميل متوسط - فرصة مناسبة";

  if (isPph && !hasHistory) {
    // If no numeric hire rate or review history, don't show a fake 7.0/10 score
    finalScore = null;
    badge = "good";
    labelAr = "عميل على PeoplePerHour - مفيش سجل كافي عنه";
  } else {
    const NO_HISTORY_CAP = 7.0;
    finalScore = Math.min(10.0, Math.max(1.0, Math.round(score * 10) / 10));
    if (!hasHistory) finalScore = Math.min(finalScore, NO_HISTORY_CAP);

    // 4. Badges & Labels: only claim what the data shows
    if (finalScore >= 8.0) {
      badge = "excellent";
      labelAr =
        hireRate !== undefined && hireRate >= 70
          ? "عميل موثوق - بيوظف بانتظام"
          : "عميل بسجل كويس على المنصة";
    } else if (finalScore >= 5.5) {
      badge = "good";
      labelAr = hasHistory
        ? "عميل متوسط - فرصة مقبولة مع تدقيق الشروط"
        : "مفيش سجل كافي عن العميل - احكم من وصف المشروع";
    } else {
      badge = "high_risk";
      labelAr = "عميل عالي المخاطر - احذر من ضياع العروض";
    }
  }

  // 5. Build dynamic platform-tailored metric chips
  const metricsChips = buildPlatformMetricsChips({
    platform,
    hireRate,
    openProjects,
    inProgressProjects,
    paymentVerified,
    clientCountry,
    clientProfession,
    clientRating,
    totalSpent,
    score: finalScore,
  });

  // 6. Tailored Negotiation Tip for Freelancer
  const negotiationTipAr = generateNegotiationTip({
    score: finalScore,
    budgetUsd,
    hireRate,
    isComplexScope,
    paymentVerified,
    redFlags,
    platform,
  });

  return {
    score: finalScore,
    badge,
    labelAr,
    hireRate,
    totalSpent,
    paymentVerified,
    clientRating,
    clientCountry,
    openProjects,
    inProgressProjects,
    clientProfession,
    platform,
    metricsChips,
    redFlags,
    greenFlags,
    negotiationTipAr,
  };
}

/**
 * Generates actionable, strategic negotiation advice tailored to the client's profile and platform.
 */
function generateNegotiationTip(params: {
  score: number | null;
  budgetUsd: number | null;
  hireRate?: number;
  isComplexScope: boolean;
  paymentVerified: boolean;
  redFlags: string[];
  platform: string;
}): string {
  const p = params.platform.toLowerCase();

  if (p.includes("mostaql")) {
    if (params.hireRate !== undefined && params.hireRate >= 70) {
      return "صاحب مشروع موثوق في مستقل بنسبة توظيف عالية؛ اقترح خطة عمل واضحة مقسمة إلى مراحل، وأرفق رابطاً لسابقة أعمالك في معرض مستقل.";
    }
    if (params.hireRate !== undefined && params.hireRate < 25 && params.hireRate > 0) {
      return "العميل في مستقل نادراً ما يوظف؛ لا تطل في عرضك بل اكتب 3 أسطر مركزة مع سؤال ذكي يجبره على الرد والتفاعل معك.";
    }
    return "في مستقل: ركز في عرضك على توضيح فهمك للمتطلبات بدقة، واقترح موعداً قريباً للبدء مع سابقة أعمالك في مستقل.";
  }

  if (p.includes("nafezly")) {
    return "في نفذلي: يفضل أصحاب المشاريع العروض المباشرة والمحددة بالتكلفة ومدة التسليم الدقيقة؛ اقترح تقسيم العمل لمرحلتين لسرعة التعاقد.";
  }

  if (p.includes("freelancer")) {
    return "في Freelancer.com: المنافسة الدولية سريعة؛ ابدأ عرضك مباشرة بحل مشكلته في أول سطرين وأرفق رابطاً حياً لعمل سابق مماثل.";
  }

  if (p.includes("pph")) {
    return "في PeoplePerHour: حدد بدقة ما إذا كان عرضك يشمل كافة جولات التعديل، وتأكد من الاتفاق على إيداع الدفعة الأولى (Deposit) قبل بدء العمل.";
  }

  if (p.includes("khamsat")) {
    return "في خمسات: المشتري يبحث عن خدمة واضحة وجاهزة؛ وضح له بالضبط ما سيحصل عليه بالخدمة الأساسية وسعر التطويرات الإضافية إن لزم.";
  }

  if (p.includes("baeed") || p.includes("remoteok") || p.includes("wwr")) {
    return "شركة تبحث عن محترف طويل الأمد؛ ركز في خطابك على سنوات خبرتك ومشاريعك السابقة الموثقة والتزامك بالمواعيد.";
  }

  if (params.score !== null && params.score >= 8.0) {
    if (params.budgetUsd && params.budgetUsd >= 200) {
      return "عميل ذو ميزانية عالية وموثوقية ممتازة؛ ركز في عرضك على الجودة وسابقة الأعمال وضمانات ما بعد التسليم بدلاً من التنافس على خفض السعر.";
    }
    return "عميل جاد يوظف بانتظام؛ ابدأ عرضك بخطاف يبرز حلاً لمشكلته مباشرة واقترح موعداً قريباً للبدء لتحظى بالأولوية.";
  }

  if (params.isComplexScope && params.budgetUsd !== null && params.budgetUsd < 50) {
    return "الميزانية غير كافية لمتطلبات المشروع بالكامل؛ اقترح في عرضك تنفيذ مرحلة أولى (MVP) مصغرة تناسب الميزانية مع تحديد تكلفة التوسعات اللاحقة.";
  }

  if (!params.paymentVerified) {
    return "وسيلة الدفع قيد التأكيد؛ احرص بشدة على إبقاء كافة تفاصيل الاتفاق والمستحقات داخل نظام الوساطة المعتمد في المنصة فقط.";
  }

  return "هذا العميل حساس للسعر والمواعيد؛ ركز في عرضك على سرعة التسليم واقترح خطة تنفيذ واضحة ومقنعة.";
}

/**
 * Returns tailored badge UI properties (colors, borders, icons)
 */
export function getClientBadgeStyles(score: number | null, isCorporate?: boolean) {
  if (isCorporate) {
    return {
      bg: "bg-purple-50 dark:bg-purple-950/40",
      border: "border-purple-200 dark:border-purple-800/60",
      text: "text-purple-700 dark:text-purple-300",
      accent: "bg-purple-500",
      icon: "🏢",
      title: "وظيفة شركة عن بُعد",
    };
  }
  if (score === null || score === undefined) {
    return {
      bg: "bg-slate-50 dark:bg-slate-900/40",
      border: "border-slate-200 dark:border-slate-800/60",
      text: "text-slate-700 dark:text-slate-300",
      accent: "bg-slate-500",
      icon: "👤",
      title: "بيانات العميل",
    };
  }
  if (score >= 8.0) {
    return {
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      border: "border-emerald-200 dark:border-emerald-800/60",
      text: "text-emerald-700 dark:text-emerald-300",
      accent: "bg-emerald-500",
      icon: "🛡️",
      title: "عميل موثوق",
    };
  }
  if (score >= 5.5) {
    return {
      bg: "bg-amber-50 dark:bg-amber-950/40",
      border: "border-amber-200 dark:border-amber-800/60",
      text: "text-amber-700 dark:text-amber-300",
      accent: "bg-amber-500",
      icon: "👤",
      title: "عميل متوسط",
    };
  }
  return {
    bg: "bg-rose-50 dark:bg-rose-950/40",
    border: "border-rose-200 dark:border-rose-800/60",
    text: "text-rose-700 dark:text-rose-300",
    accent: "bg-rose-500",
    icon: "⚠️",
    title: "عميل عالي المخاطر",
  };
}

// ==============================================================================
// Helper Extraction & Normalization Utilities
// ==============================================================================

function extractTitle(postText?: string): string {
  if (!postText) return "";
  const match = postText.match(/عنوان[:\s]*([^\n\r]+)/i);
  return match ? match[1].trim() : "";
}

function extractDetails(postText?: string): string {
  if (!postText) return "";
  const match = postText.match(/التفاصيل[:\s]*([\s\S]+)/i);
  return match ? match[1].trim() : postText;
}

function extractProfessionFromAuthor(author?: string | null): string | undefined {
  if (!author) return undefined;
  const match = author.match(/\(([^)]+)\)/);
  return match ? match[1].trim() : undefined;
}

function extractHireRateFromText(text: string): number | undefined {
  const match =
    text.match(/معدل\s*توظيف[:\s]*(\d+(?:\.\d+)?)\s*%/i) ||
    text.match(/hire\s*rate[:\s]*(\d+(?:\.\d+)?)\s*%/i) ||
    text.match(/(\d+(?:\.\d+)?)\s*%\s*hire\s*rate/i);
  return match ? parseFloat(match[1]) : undefined;
}

function extractOpenProjectsFromText(text: string): number | undefined {
  const match =
    text.match(/(\d+)\s*(?:مشاريع|مشروع)\s*مفتوح/i) ||
    text.match(/(\d+)\s*open\s*jobs?/i);
  return match ? parseInt(match[1], 10) : undefined;
}

function extractInProgressFromText(text: string): number | undefined {
  const match =
    text.match(/(\d+)\s*قيد\s*التنفيذ/i) ||
    text.match(/(\d+)\s*in-?progress/i);
  return match ? parseInt(match[1], 10) : undefined;
}

function extractRatingFromText(text: string): number | undefined {
  const match =
    text.match(/تقييم[:\s]*([0-5](?:\.\d+)?)\s*(?:\/\s*5)?/i) ||
    text.match(/rating[:\s]*([0-5](?:\.\d+)?)\s*(?:\/\s*5)?/i) ||
    text.match(/([0-5](?:\.\d+)?)\s*stars?/i);
  return match ? parseFloat(match[1]) : undefined;
}

function extractSpentFromText(text: string): string | undefined {
  const match =
    text.match(/(?:\$|usd|دولار)\s*([\d,]+(?:\.\d+)?(?:\s*[kKmM])?)\s*(?:total\s*spent|إجمالي\s*الإنفاق)?/i) ||
    text.match(/إجمالي\s*الإنفاق[:\s]*([\d,]+(?:\.\d+)?(?:\s*[kKmM])?\s*(?:\$|دولار|usd|رس)?)/i) ||
    text.match(/total\s*spent[:\s]*\$?([\d,]+(?:\.\d+)?(?:\s*[kKmM])?)/i);
  return match ? match[1].trim() : undefined;
}

function inferPaymentVerified(
  text: string,
  _platform: string,
  _hireRate?: number
): boolean {
  // Only an explicit statement counts. Platform type, a past hire, or generic words like
  // "موثق" in the project text are not evidence that this client is verified.
  if (text.includes("payment unverified") || text.includes("وسيلة الدفع غير موثقة")) return false;
  return (
    text.includes("payment verified") ||
    text.includes("payment method verified") ||
    text.includes("تم التحقق من وسيلة الدفع")
  );
}

function formatSpentString(val: string | number): string {
  if (typeof val === "number") {
    if (val >= 1000) return `$${(val / 1000).toFixed(1)}k`;
    return `$${val}`;
  }
  return String(val).trim();
}

function extractBudgetNumber(budget: any): number | null {
  if (typeof budget === "number") return budget;
  if (!budget) return null;
  const match = String(budget).match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}
