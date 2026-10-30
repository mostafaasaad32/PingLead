// ==============================================================================
// src/lib/ai/profile-importer.ts
// AI-Powered Profile Importer & Audit Engine
// Supports Upwork Profile PDF, Mostaql, Khamsat, Nafathly, GitHub, & Raw Text
// ==============================================================================

import * as cheerio from "cheerio";
import dns from "node:dns";

// Force IPv4 first in Node.js to prevent 30-second IPv6 connection timeouts on Windows
try {
  dns.setDefaultResultOrder("ipv4first");
} catch { }

export interface ExtractedPortfolioItem {
  title: string;
  description: string;
  project_url?: string | null;
  imageUrl?: string | null;
  skills: string[];
  category?: string;
}

export interface ExtractedProfileData {
  fullName: string;
  headline: string;
  bio: string;
  hourlyRate?: string;
  totalJobs?: string | number;
  totalHours?: string | number;
  activeContracts?: string[];
  skills: string[];
  portfolioItems: ExtractedPortfolioItem[];
  portfolioCount?: number;
  catalogCount?: number;
  employmentHistory?: Array<{
    title: string;
    company: string;
    description?: string;
  }>;
  education?: Array<{
    degree: string;
    institution: string;
  }>;
  certifications?: Array<{
    title: string;
    provider?: string;
  }>;
  hasVideo?: boolean;
  avatarUrl?: string;
  platformType?: "upwork" | "mostaql" | "nafezly" | "khamsat" | "freelancer" | "github" | "pinglead" | "custom";
  sourceUrl?: string;
  stats?: {
    totalJobs?: string | number;
    totalHours?: string | number;
    hourlyRate?: string;
    activeContracts?: string[];
    completionRate?: string;
    rehireRate?: string;
    onTimeDelivery?: string;
    responseSpeed?: string;
    completedProjects?: string | number;
    portfolioCount?: number;
    sellerLevel?: string;
    overallRating?: string | number;
    clientsCount?: string | number;
    badges?: string[];
    activeServicesCount?: number;
  };
  gigs?: Array<{
    title: string;
    price?: string;
    salesCount?: string | number;
    rating?: string | number;
    url?: string;
  }>;
}

export type VollnaSectionStatus = "good" | "warning" | "critical";

export interface VollnaAuditTitleSection {
  status: VollnaSectionStatus;
  currentText: string;
  analysis: string;
  suggestions: Array<{
    label: string;
    subtitle: string;
    content: string;
  }>;
}

export interface VollnaAuditImageSection {
  status: VollnaSectionStatus;
  analysis: string;
}

export interface VollnaAuditSuggestedBlock {
  id: "hook" | "unique_value" | "how_you_help" | "proof" | "cta";
  title: string;
  subtitle: string;
  content?: string;
  bullets?: string[];
}

export interface VollnaAuditOverviewSection {
  status: VollnaSectionStatus;
  currentText: string;
  wordCount: number;
  charCount: number;
  suggestedStructure: VollnaAuditSuggestedBlock[];
  fullRewrittenOverview: string;
}

export interface VollnaAuditSkillsSection {
  status: VollnaSectionStatus;
  usedSlots: number;
  maxSlots: number;
  currentSkills: string[];
  analysis: string;
  skillsToAdd: string[];
  skillsToReorder: Array<{
    skill: string;
    fromRank: number;
    toRank: number;
  }>;
}

export interface VollnaAuditPortfolioSection {
  status: VollnaSectionStatus;
  currentCount: number;
  alertTitle: string;
  alertMessage: string;
  currentItems?: ExtractedPortfolioItem[];
  projectIdeas: Array<{
    title: string;
    description: string;
    whyItWorks?: string;
  }>;
}

export interface VollnaAuditExperienceSection {
  status: VollnaSectionStatus;
  alertTitle: string;
  alertMessage: string;
  rolesToAdd: Array<{
    title: string;
    description: string;
  }>;
  employmentHistoryNote: string;
  employmentRewrites: Array<{
    currentRole: string;
    company: string;
    recommendedTitle: string;
    recommendedDescription: string;
    whyItWorks: string;
  }>;
  suggestedAdditions: Array<{
    type: string;
    title: string;
    description: string;
  }>;
}

export interface VollnaAuditVideoSection {
  status: VollnaSectionStatus;
  hasVideo: boolean;
  analysis: string;
  scriptSections: Array<{
    title: string;
    content: string;
  }>;
}

export interface VollnaAuditCatalogSection {
  status: VollnaSectionStatus;
  currentCount: number;
  infoBanner: string;
  alertTitle: string;
  alertMessage: string;
  projectIdeas: Array<{
    title: string;
    description: string;
    rationale: string;
  }>;
}

export interface VollnaAuditTrustMetricsSection {
  status: VollnaSectionStatus;
  analysis: string;
  badges: string[];
  metrics: Array<{
    name: string;
    currentValue: string;
    targetValue: string;
    impact: string;
  }>;
  tips: string[];
}

export interface VollnaAuditGigsSection {
  status: VollnaSectionStatus;
  analysis: string;
  currentCount: number;
  currentGigs?: Array<{ title: string; price?: string }>;
  suggestedGigs: Array<{
    title: string;
    category: string;
    price: string;
    deliveryTime: string;
    description: string;
    whyItSells: string;
  }>;
}

export interface VollnaAuditUpsellsSection {
  status: VollnaSectionStatus;
  analysis: string;
  strategies: Array<{
    gigTitle: string;
    basePrice: string;
    upsellTiers: Array<{
      addon: string;
      extraPrice: string;
      extraDays: string;
      pitch: string;
    }>;
  }>;
}

export interface VollnaProfileAuditResult {
  freelancerName: string;
  currentTitle: string;
  avatarUrl?: string | null;
  overallScore: number;
  executiveSummary: string;
  stats?: {
    totalJobs?: string | number;
    totalHours?: string | number;
    hourlyRate?: string;
    activeContracts?: string[];
    completionRate?: string;
    rehireRate?: string;
    onTimeDelivery?: string;
    responseSpeed?: string;
    completedProjects?: string | number;
    portfolioCount?: number;
    sellerLevel?: string;
    overallRating?: string | number;
    clientsCount?: string | number;
    badges?: string[];
    activeServicesCount?: number;
  };
  platformStats?: Array<{
    label: string;
    value: string | number;
    icon?: string;
    color?: string;
  }>;
  sections: {
    title: VollnaAuditTitleSection;
    image: VollnaAuditImageSection;
    overview: VollnaAuditOverviewSection;
    skills: VollnaAuditSkillsSection;
    portfolio: VollnaAuditPortfolioSection;
    experience: VollnaAuditExperienceSection;
    video: VollnaAuditVideoSection;
    catalog: VollnaAuditCatalogSection;
    trust_metrics?: VollnaAuditTrustMetricsSection;
    gigs?: VollnaAuditGigsSection;
    upsells?: VollnaAuditUpsellsSection;
  };
  platform?: string;
  platformType?: "upwork" | "mostaql" | "nafezly" | "khamsat" | "freelancer" | "github" | "pinglead" | "custom";
  auditUrl?: string;
  auditedAt?: string;
}

const CANDIDATE_GEMINI_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.8-flash",
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
];

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "ar,en-US;q=0.9,en;q=0.8",
};

/**
 * Call Gemini with multi-model fallback and strict JSON parsing
 */
async function callGemini(contents: any[], systemInstruction?: string): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in environment variables.");
  }

  let lastError: any = null;

  for (const model of CANDIDATE_GEMINI_MODELS) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload: any = {
        contents,
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          maxOutputTokens: 4096,
        },
      };

      if (systemInstruction) {
        payload.systemInstruction = {
          parts: [{ text: systemInstruction }],
        };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.warn(`[Gemini Importer] Model ${model} returned ${res.status}: ${errorText.slice(0, 150)}`);
        continue;
      }

      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        console.warn(`[Gemini Importer] Model ${model} returned empty response.`);
        continue;
      }

      // Clean markdown code blocks if present
      let cleaned = rawText.trim();
      if (cleaned.startsWith("```json")) {
        cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }

      const parsed = JSON.parse(cleaned);
      return parsed;
    } catch (err: any) {
      console.warn(`[Gemini Importer] Exception on ${model}:`, err.message);
      lastError = err;
    }
  }

  throw new Error(
    `Failed to process with Gemini AI: ${lastError?.message || "All models failed"}`
  );
}

/**
 * Helper to determine category from item details
 */
export function inferProjectCategory(
  title: string,
  desc: string,
  skills: string[] = []
): string {
  const combined = `${title} ${desc} ${skills.join(" ")}`.toLowerCase();
  if (
    combined.includes("design") ||
    combined.includes("ui/ux") ||
    combined.includes("figma") ||
    combined.includes("logo") ||
    combined.includes("تصميم") ||
    combined.includes("هوية")
  ) {
    return "design";
  }
  if (
    combined.includes("marketing") ||
    combined.includes("seo") ||
    combined.includes("ads") ||
    combined.includes("تسويق") ||
    combined.includes("إعلانات")
  ) {
    return "marketing";
  }
  if (
    combined.includes("writing") ||
    combined.includes("content") ||
    combined.includes("ترجمة") ||
    combined.includes("كتابة") ||
    combined.includes("مقال")
  ) {
    return "writing";
  }
  if (
    combined.includes("accounting") ||
    combined.includes("finance") ||
    combined.includes("محاسبة") ||
    combined.includes("مالي") ||
    combined.includes("ضرائب")
  ) {
    return "accounting";
  }
  return "web_dev";
}

/**
 * Helper to extract avatar / portrait URL from raw text, HTML, or markdown
 */
export function extractAvatarFromText(text: string): string | undefined {
  if (!text || typeof text !== "string") return undefined;

  // 1. Upwork portrait markdown: ![Image 1: ...](https://www.upwork.com/profile-portraits/...)
  const upworkMd = text.match(/!\[Image[^\]]*\]\((https:\/\/[^)]*profile-portraits[^)]*)\)/i);
  if (upworkMd && upworkMd[1]) return upworkMd[1].trim();

  // 2. Upwork portrait raw URL: https://www.upwork.com/profile-portraits/...
  const upworkRaw = text.match(/https:\/\/[^\s"'()<>]*profile-portraits[^\s"'()<>]*/i);
  if (upworkRaw && upworkRaw[0]) return upworkRaw[0].trim();

  // 3. Mostaql / Khamsat / Hsoub CDN avatar: https://avatars.hsoubcdn.com/...
  const hsoubAvatar = text.match(/https:\/\/avatars\.hsoubcdn\.com\/[a-f0-9]+(?:\?s=\d+)?/i);
  if (hsoubAvatar && hsoubAvatar[0]) return hsoubAvatar[0].trim();

  // 4. GitHub avatar: https://avatars.githubusercontent.com/u/...
  const ghAvatar = text.match(/https:\/\/avatars\.githubusercontent\.com\/u\/[^\s"'()<>]+/i);
  if (ghAvatar && ghAvatar[0]) return ghAvatar[0].trim();

  // 5. Nafezly avatar: https://nafezly.com/uploads/... or https://...nafezly.com/avatars/...
  const nafezlyAvatar = text.match(/https:\/\/[^\s"'()<>]*nafezly\.com\/(?:uploads|avatars)[^\s"'()<>]*/i);
  if (nafezlyAvatar && nafezlyAvatar[0]) return nafezlyAvatar[0].trim();

  // 6. Gravatar
  const gravatar = text.match(/https:\/\/(?:[a-z0-9]+\.)?gravatar\.com\/avatar\/[a-f0-9]+[^\s"'()<>]+/i);
  if (gravatar && gravatar[0]) return gravatar[0].trim();

  // 7. General markdown avatar: ![Avatar](https://...)
  const generalAvatar = text.slice(0, 3000).match(/!\[(?:avatar|profile|headshot|portrait)[^\]]*\]\((https:\/\/[^)]+)\)/i);
  if (generalAvatar && generalAvatar[1] && !generalAvatar[1].includes("logo") && !generalAvatar[1].includes("badge")) {
    return generalAvatar[1].trim();
  }

  return undefined;
}


/**
 * Extract profile & portfolio from Upwork PDF Buffer using Gemini's native document reading
 */
export async function extractProfileFromPdfBuffer(
  pdfBuffer: Buffer
): Promise<ExtractedProfileData> {
  const base64Pdf = pdfBuffer.toString("base64");

  const promptText = `
You are an expert talent scout and freelance profile parser.
Thoroughly read and extract all details from this Upwork Profile PDF document.

Extract:
1. "fullName": The freelancer's full name.
2. "headline": The main professional title/headline (e.g., "Full-Stack Web Developer | React & Node.js").
3. "bio": The complete Overview / About bio text, preserving paragraphs.
4. "hourlyRate": The hourly rate if mentioned (e.g., "$45.00/hr"), or null.
5. "skills": An array of all skills listed in the Skills section or mentioned in the profile.
6. "portfolioItems": A consolidated array combining:
   - The official "Portfolio" projects section
   - AND all completed client projects listed under "Work History and feedback" (treat each work history contract as a past project proof item).
   
   CRITICAL RULE (NO FABRICATIONS / NO HALLUCINATIONS):
   - Extract ONLY real items that explicitly appear in the PDF under "Portfolio" or completed contracts under "Work History".
   - If the PDF has NO portfolio projects and NO completed client contracts, return an empty array: "portfolioItems": [].
   - STRICTLY FORBIDDEN: NEVER invent, fabricate, imagine, or synthesize any projects from the bio, headline, or skills!

   For each real item found in portfolioItems, provide:
   - "title": A clear descriptive title of the project or completed contract.
   - "description": The project description, client feedback received, or technologies utilized.
   - "project_url": Any live link, demo, or repository URL if mentioned, otherwise null.
   - "skills": Array of technologies and skills relevant to this specific project.

Respond STRICTLY with a valid JSON object matching this schema:
{
  "fullName": string,
  "headline": string,
  "bio": string,
  "hourlyRate": string,
  "skills": string[],
  "portfolioItems": [
    {
      "title": string,
      "description": string,
      "project_url": string | null,
      "skills": string[]
    }
  ]
}
`.trim();

  const contents = [
    {
      parts: [
        {
          inlineData: {
            mimeType: "application/pdf",
            data: base64Pdf,
          },
        },
        {
          text: promptText,
        },
      ],
    },
  ];

  const result = await callGemini(contents);

  return normalizeExtractedData(result);
}

/**
 * Scrape profile from URL (Upwork, Mostaql, Khamsat, Nafathly, GitHub, or generic)
 */
export async function extractProfileFromUrl(
  profileUrl: string
): Promise<ExtractedProfileData> {
  const trimmedUrl = profileUrl.trim();
  const lowerUrl = trimmedUrl.toLowerCase();

  // 0. Upwork (upwork.com/freelancers/... or upwork.com/fl/...)
  if (lowerUrl.includes("upwork.com/")) {
    return scrapeUpwork(trimmedUrl);
  }

  // 1. Mostaql (mostaql.com/u/username)
  if (lowerUrl.includes("mostaql.com/")) {
    const { scrapeMostaqlProfile } = await import("./profile-fetcher");
    return scrapeMostaqlProfile(trimmedUrl);
  }

  // 2. Khamsat (khamsat.com/user/username)
  if (lowerUrl.includes("khamsat.com/user/")) {
    const { scrapeKhamsatProfile } = await import("./profile-fetcher");
    return scrapeKhamsatProfile(trimmedUrl);
  }

  // 3. Nafathly (nafezly.com/u/username)
  if (lowerUrl.includes("nafezly.com/u/")) {
    const { scrapeNafezlyProfile } = await import("./profile-fetcher");
    return scrapeNafezlyProfile(trimmedUrl);
  }

  // 4. GitHub (github.com/username)
  if (lowerUrl.includes("github.com/")) {
    return scrapeGitHub(trimmedUrl);
  }

  // 5. Generic profile URL
  return scrapeGenericUrl(trimmedUrl);
}

/**
 * Deep extractor for Upwork stats, contracts, skills, employment, and education
 */
export function extractUpworkDeepStats(text: string): {
  totalJobs?: string;
  totalHours?: string;
  hourlyRate?: string;
  activeContracts?: string[];
  skills?: string[];
  employmentHistory?: Array<{ title: string; company: string; description?: string }>;
  education?: Array<{ degree: string; institution: string }>;
  certifications?: Array<{ title: string; provider?: string }>;
} {
  const stats: {
    totalJobs?: string;
    totalHours?: string;
    hourlyRate?: string;
    activeContracts?: string[];
    skills?: string[];
    employmentHistory?: Array<{ title: string; company: string; description?: string }>;
    education?: Array<{ degree: string; institution: string }>;
    certifications?: Array<{ title: string; provider?: string }>;
  } = {};

  // Total jobs
  const jobsMatch =
    text.match(/####\s*(\d+)\s*\n\s*Total jobs/i) ||
    text.match(/(\d+)\s*Total jobs/i) ||
    text.match(/worked\s*(\d+)\s*fixed-price job/i);
  if (jobsMatch) stats.totalJobs = jobsMatch[1];
  else stats.totalJobs = "";

  // Total hours
  const hoursMatch =
    text.match(/####\s*([0-9—]+)\s*\n[^\n]*Total hours/i) ||
    text.match(/([0-9]+)\s*Total hours/i);
  if (hoursMatch) stats.totalHours = hoursMatch[1] === "—" ? "0" : hoursMatch[1];
  else stats.totalHours = "";

  // Hourly rate
  const rateMatch = text.match(/\$([0-9.]+)\s*\/\s*(?:hr|hour)/i);
  if (rateMatch) stats.hourlyRate = `$${rateMatch[1]}/hr`;
  else stats.hourlyRate = "";

  // Active contracts / LBLX
  const activeContracts: string[] = [];
  const lblxMatch = text.match(/LBLX[A-Za-z0-9_-]+/g);
  if (lblxMatch) {
    lblxMatch.forEach((c) => {
      if (!activeContracts.includes(c)) activeContracts.push(c);
    });
  }
  const inProgressMatch = text.match(/([^\n]+)\s*\n\s*(?:In progress|Active contract)/gi);
  if (inProgressMatch) {
    inProgressMatch.forEach((m) => {
      const clean = m.replace(/In progress|Active contract/gi, "").trim();
      if (clean && !activeContracts.includes(clean)) activeContracts.push(clean);
    });
  }
  stats.activeContracts = activeContracts;

  // Skills in exact order
  const skills: string[] = [];
  const skillsSectionMatch = text.match(/####\s*Skills\s*\n([\s\S]*?)(?:####|###|$)/i);
  if (skillsSectionMatch) {
    const lines = skillsSectionMatch[1].split("\n");
    for (const line of lines) {
      const clean = line.replace(/^[-*•]\s*/, "").replace(/\[|\]/g, "").trim();
      if (
        clean &&
        clean.length > 1 &&
        clean.length < 50 &&
        !clean.includes("http") &&
        !skills.includes(clean) &&
        !clean.startsWith("Search")
      ) {
        skills.push(clean);
      }
    }
  }
  if (skills.length > 0) stats.skills = skills;

  // Employment
  const employmentHistory: Array<{ title: string; company: string; description?: string }> = [];
  const empMatch = text.match(/(?:####\s*)?(?:Employment history|Work history)\s*\n([\s\S]*?)(?:####|###|Education|Certifications|$)/i);
  if (empMatch) {
    const rawBlocks = empMatch[1].split(/\n\s*\n/);
    for (const block of rawBlocks) {
      const lines = block
        .split("\n")
        .map((l) => l.replace(/^[-*•#\s]+/, "").trim())
        .filter(Boolean);
      if (lines.length >= 2) {
        employmentHistory.push({
          title: lines[0],
          company: lines[1],
          description: lines.slice(2).join(" "),
        });
      } else if (lines.length === 1 && lines[0].includes("|")) {
        const [title, company] = lines[0].split("|").map((s) => s.trim());
        employmentHistory.push({ title, company: company || "" });
      }
    }
  }
  stats.employmentHistory = employmentHistory;

  // Education
  const education: Array<{ degree: string; institution: string }> = [];
  const eduMatch = text.match(/(?:####\s*)?Education\s*\n([\s\S]*?)(?:####|###|Certifications|Employment|$)/i);
  if (eduMatch) {
    const rawBlocks = eduMatch[1].split(/\n\s*\n/);
    for (const block of rawBlocks) {
      const lines = block
        .split("\n")
        .map((l) => l.replace(/^[-*•#\s]+/, "").trim())
        .filter(Boolean);
      if (lines.length >= 2) {
        education.push({
          degree: lines[1],
          institution: lines[0],
        });
      } else if (lines.length === 1 && (lines[0].includes(" at ") || lines[0].includes(" - "))) {
        const parts = lines[0].split(/\s+(?:at|-)\s+/);
        education.push({ degree: parts[0], institution: parts[1] || "" });
      }
    }
  }
  stats.education = education;

  // Certifications
  const certifications: Array<{ title: string; provider?: string }> = [];
  const certMatch = text.match(/(?:####\s*)?Certifications?\s*\n([\s\S]*?)(?:####|###|Education|Employment|$)/i);
  if (certMatch) {
    const lines = certMatch[1]
      .split("\n")
      .map((l) => l.replace(/^[-*•#\s]+/, "").trim())
      .filter(Boolean);
    for (const line of lines) {
      if (line.length > 2 && line.length < 80) {
        const parts = line.split(/\s*\(|\)\s*/).filter(Boolean);
        certifications.push({
          title: parts[0],
          provider: parts[1] || undefined,
        });
      }
    }
  }
  stats.certifications = certifications;

  return stats;
}

/**
 * Strict Deterministic Scoring Algorithm matching Vollna's exact weighting
 */
export function calculateVollnaDeterministicScore(data: {
  portfolioCount: number;
  catalogCount: number;
  skillsCount: number;
  employmentCount: number;
  bio: string;
  headline: string;
  hasVideo: boolean;
  hasAvatar: boolean;
}): number {
  // 1. Market Proof & Completeness (20 pts)
  let marketProof = 20;
  if (data.portfolioCount === 0) {
    marketProof -= 15; // biggest gap
  } else if (data.portfolioCount < 3) {
    marketProof -= 8;
  }
  if (data.catalogCount === 0) {
    marketProof -= 5;
  }

  // 2. Skills Utilization (15 pts) - max 20 slots on Upwork
  let skillsScore = 15;
  if (data.skillsCount < 10) {
    skillsScore = 6; // e.g. 8/20 gets 6/15
  } else if (data.skillsCount < 15) {
    skillsScore = 10;
  } else {
    skillsScore = 15;
  }

  // 3. Employment & Experience Depth (15 pts)
  let experienceScore = 15;
  if (data.employmentCount <= 1) {
    experienceScore = 7; // only 1 entry gets 7/15
  } else if (data.employmentCount === 2) {
    experienceScore = 11;
  } else {
    experienceScore = 15;
  }

  // 4. Overview Structure & Client-Centricity (20 pts)
  let overviewScore = 18;
  const lowerBio = (data.bio || "").trim().toLowerCase();
  if (
    lowerBio.startsWith("as a dedicated") ||
    lowerBio.startsWith("as a ") ||
    lowerBio.startsWith("i am ") ||
    lowerBio.startsWith("i'm ") ||
    lowerBio.startsWith("hello, i am") ||
    lowerBio.startsWith("my name is")
  ) {
    overviewScore -= 10; // freelancer-centered opening
  }
  if (data.bio.length < 500) {
    overviewScore -= 3;
  }

  // 5. Title Clarity & Niche Focus (15 pts)
  let titleScore = 14;
  const rawTitle = (data.headline || "").trim();
  const separators = (rawTitle.match(/[|&/,-]/g) || []).length;
  if (!rawTitle) {
    titleScore = 5;
  } else if (separators >= 3 || rawTitle.length > 70) {
    titleScore = 9; // splitting intent across multiple disparate niches
  } else if (separators >= 1) {
    titleScore = 12;
  }

  // 6. Image & Video Introduction (15 pts)
  let imageVideoScore = 0;
  if (data.hasAvatar) imageVideoScore += 10;
  else imageVideoScore += 5;

  if (data.hasVideo) imageVideoScore += 5;
  else imageVideoScore += 0;

  const total = Math.min(
    100,
    Math.max(0, marketProof + skillsScore + experienceScore + overviewScore + titleScore + imageVideoScore)
  );
  return total;
}

/**
 * Strict Deterministic Scoring Algorithm for Mostaql & Nafezly
 * 1. Arabic Portfolio (30 pts): 0 items = -25 pts, < 4 items = -12 pts, 4+ = 30 pts.
 * 2. Persuasive Bio & Structure (25 pts): Arab client-centric, Hook, Value, Proof.
 * 3. Trust Metrics & Badges (20 pts): Completion >= 95%, rehire, verified badge.
 * 4. Job Title & Search Intent (15 pts): Clear niche focus.
 * 5. Skills & Avatar (10 pts): 5+ skills (5 pts) + Photo (5 pts).
 */
export function calculateMostaqlDeterministicScore(data: {
  portfolioCount: number;
  completionRate?: string;
  rehireRate?: string;
  badges?: string[];
  skillsCount: number;
  bio: string;
  headline: string;
  hasAvatar: boolean;
}): number {
  // 1. Arabic Portfolio (30 pts)
  let portfolioScore = 30;
  if (data.portfolioCount === 0) {
    portfolioScore = 5; // Deduct 25 pts immediately
  } else if (data.portfolioCount < 4) {
    portfolioScore = 18; // Deduct 12 pts
  } else {
    portfolioScore = 30;
  }

  // 2. Persuasive Bio & Structure (25 pts)
  let bioScore = 24;
  const lowerBio = (data.bio || "").trim();
  if (
    lowerBio.startsWith("أنا ") ||
    lowerBio.startsWith("اسمي ") ||
    lowerBio.startsWith("مهندس ") ||
    lowerBio.startsWith("مستقل ") ||
    lowerBio.startsWith("أعمل كـ") ||
    lowerBio.length < 150
  ) {
    bioScore -= 8;
  }
  if (lowerBio.length < 400) {
    bioScore -= 3;
  }

  // 3. Trust Metrics & Badges (20 pts)
  let trustScore = 18;
  const compNum = parseInt((data.completionRate || "100").replace(/[^0-9]/g, ""), 10) || 100;
  if (compNum < 80) trustScore -= 7;
  else if (compNum < 95) trustScore -= 3;

  const hasVerifiedBadge = (data.badges || []).some(
    (b) => b.includes("موثقة") || b.includes("ملتزم") || b.includes("متميز")
  );
  if (!hasVerifiedBadge) trustScore -= 5;

  // 4. Job Title & Keywords (15 pts)
  let titleScore = 14;
  const title = (data.headline || "").trim();
  if (!title || title.length < 5 || title.includes("مستقل مسجل")) {
    titleScore = 8;
  } else if (title.includes("|") && title.length > 40) {
    titleScore = 12;
  }

  // 5. Skills & Avatar (10 pts)
  let skillsAvatarScore = 0;
  if (data.skillsCount >= 5) skillsAvatarScore += 5;
  else if (data.skillsCount >= 2) skillsAvatarScore += 3;
  else skillsAvatarScore += 1;

  if (data.hasAvatar) skillsAvatarScore += 5;
  else skillsAvatarScore += 2;

  const total = Math.min(
    100,
    Math.max(15, portfolioScore + bioScore + trustScore + titleScore + skillsAvatarScore)
  );
  return total;
}

/**
 * Strict Deterministic Scoring Algorithm for Khamsat Micro-Services
 * 1. Services & Gigs Quality (35 pts): 0 gigs = 5 pts, 1 gig = 18 pts, 2 = 26 pts, 3+ = 35 pts.
 * 2. Upsells & Order Value (25 pts): Ability to raise order value above $5.
 * 3. Bio & Seller Trust (20 pts): Client reassurance & guarantees.
 * 4. Seller Rank & Response Speed (20 pts): Level (مميز/موثوق/نشيط/جديد) + response rate.
 */
export function calculateKhamsatDeterministicScore(data: {
  gigsCount: number;
  sellerLevel?: string;
  responseSpeed?: string;
  bio: string;
  hasAvatar: boolean;
}): number {
  // 1. Services & Gigs (35 pts)
  let gigsScore = 35;
  if (data.gigsCount === 0) gigsScore = 5;
  else if (data.gigsCount === 1) gigsScore = 18;
  else if (data.gigsCount === 2) gigsScore = 26;

  // 2. Upsells & Order Value (25 pts)
  let upsellsScore = data.gigsCount >= 2 ? 23 : 15;

  // 3. Bio & Seller Trust (20 pts)
  let bioScore = data.bio && data.bio.length > 100 ? 18 : 10;

  // 4. Seller Rank & Response Speed (20 pts)
  let rankScore = 12;
  const level = data.sellerLevel || "بائع جديد";
  if (level.includes("مميز") || level.includes("موثوق")) rankScore = 20;
  else if (level.includes("نشيط")) rankScore = 16;
  else rankScore = 10;

  const total = Math.min(100, Math.max(20, gigsScore + upsellsScore + bioScore + rankScore));
  return total;
}

/**
 * Clean Upwork markdown by removing mega navigation menu without dropping bottom profile sections
 */
function cleanUpworkMarkdown(text: string): string {
  const titleMatch = text.match(/^Title:\s*([^\r\n]+)/m);
  const possibleName = titleMatch ? titleMatch[1].trim() : "";

  let startIndex = -1;
  if (possibleName && possibleName !== "Upwork" && possibleName !== "Upwork Freelancer") {
    startIndex = text.indexOf(`### ${possibleName}`);
  }
  if (startIndex === -1) {
    const aboutIdx = text.search(/####\s*About/i);
    if (aboutIdx !== -1) {
      startIndex = Math.max(0, text.lastIndexOf("### ", aboutIdx));
    }
  }

  let cleaned = startIndex !== -1 ? text.slice(startIndex) : text;

  // Only remove generic Upwork navigation footer (e.g. Terms of Service, Privacy Policy, copyright)
  // Ensure we NEVER truncate profile sections like Employment, Education, Certifications, Catalog, or Portfolio!
  const footerIdx = cleaned.search(/(?:©\s*2015\s*-\s*\d{4}\s*Upwork|Footer navigation|Company\s*About Us\s*Feedback)/i);
  if (footerIdx !== -1 && footerIdx > 500) {
    cleaned = cleaned.slice(0, footerIdx);
  }

  return cleaned.trim();
}

function isUpworkProfileLocked(text: string): boolean {
  const hasLockText =
    text.includes("only available to Upwork customers") ||
    text.includes("Please login or sign up to view their profile") ||
    text.includes("This freelancer's profile is only available");

  const hasProfileContent =
    text.includes("#### About") ||
    text.includes("#### Skills") ||
    text.includes("Rate") ||
    text.includes("Total jobs");

  return hasLockText && !hasProfileContent;
}

/**
 * Scrape Upwork Profile from URL
 */
async function scrapeUpwork(url: string): Promise<ExtractedProfileData> {
  let cleanUrl = url.trim();
  if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
    cleanUrl = `https://${cleanUrl}`;
  }
  cleanUrl = cleanUrl.replace(/[?#].*$/, "");

  let content = "";
  let isLoginRequired = false;

  // 1. Try Jina Reader via fetch (fast with ipv4first)
  try {
    const jinaRes = await fetch(`https://r.jina.ai/${cleanUrl}`, {
      headers: {
        Accept: "text/plain",
        "User-Agent": "PingLead-Profile-Importer/1.0",
      },
      signal: AbortSignal.timeout(12000),
    });

    if (jinaRes.ok) {
      const text = await jinaRes.text();
      if (isUpworkProfileLocked(text)) {
        isLoginRequired = true;
      } else if (text.length > 500 && !text.includes("403 Forbidden") && !text.includes("Attention Required")) {
        content = text;
      }
    }
  } catch (err: any) {
    console.warn("[Upwork Scraper] Jina fetch error:", err.message);
  }

  // 2. Try curl fallback if fetch failed or timed out (Windows undici IPv6 fix)
  if (!content && !isLoginRequired) {
    try {
      const { execSync } = await import("child_process");
      const rawCurl = execSync(`curl.exe -s -m 15 "https://r.jina.ai/${cleanUrl}"`, {
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
      });
      if (rawCurl && rawCurl.length > 500) {
        if (isUpworkProfileLocked(rawCurl)) {
          isLoginRequired = true;
        } else if (!rawCurl.includes("403 Forbidden") && !rawCurl.includes("Attention Required")) {
          content = rawCurl;
        }
      }
    } catch (err: any) {
      console.warn("[Upwork Scraper] Jina curl fallback error:", err.message);
    }
  }

  // 3. Try direct fetch with browser headers if Jina didn't get public profile
  if (!content && !isLoginRequired) {
    try {
      const res = await fetch(cleanUrl, {
        headers: BROWSER_HEADERS,
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const html = await res.text();
        if (isUpworkProfileLocked(html)) {
          isLoginRequired = true;
        } else if (html.length > 1000 && !html.includes("Attention Required")) {
          const $ = cheerio.load(html);
          $("script, style, noscript, nav, footer").remove();
          content = $("body").text().replace(/\s+/g, " ").trim();
        }
      }
    } catch { }
  }

  if (isLoginRequired) {
    throw new Error(
      "بروفايل Upwork هذا محمي بإعدادات الخصوصية (Upwork Users Only) أو مسجل كـ Private ويتطلب تسجيل الدخول. يمكنك نسخ نص بروفايلك ولصقه في تبويب 'نص خام' لفهصه فوراً."
    );
  }

  if (!content || content.length < 200) {
    throw new Error(
      "تعذر قراءة بيانات بروفايل Upwork عبر الرابط بسبب حماية الخصوصية من Upwork. يرجى التأكد من صحة الرابط أو نسخ ولصق نص النبذة في تبويب 'نص خام'."
    );
  }

  const avatarUrl = extractAvatarFromText(content);
  const deepStats = extractUpworkDeepStats(content);
  const cleanedContent = cleanUpworkMarkdown(content);
  const result = await extractProfileFromRawText(`Platform: Upwork\n${cleanedContent}`);
  if (avatarUrl) {
    result.avatarUrl = avatarUrl;
  }
  if (deepStats.totalJobs) result.totalJobs = deepStats.totalJobs;
  if (deepStats.totalHours) result.totalHours = deepStats.totalHours;
  if (deepStats.hourlyRate) result.hourlyRate = deepStats.hourlyRate;
  if (deepStats.activeContracts && deepStats.activeContracts.length > 0) result.activeContracts = deepStats.activeContracts;
  if (deepStats.skills && deepStats.skills.length > 0) result.skills = deepStats.skills;
  if (deepStats.employmentHistory && deepStats.employmentHistory.length > 0) result.employmentHistory = deepStats.employmentHistory;
  if (deepStats.education && deepStats.education.length > 0) result.education = deepStats.education;
  const hasNoPublicPortfolio =
    !content.includes("Portfolio") ||
    /Portfolio\s*(?:\(0\)|:\s*0|0\s*items)/i.test(content) ||
    content.includes("No portfolio items yet") ||
    content.includes("has not published any portfolio");

  if (hasNoPublicPortfolio) {
    result.portfolioItems = [];
    result.portfolioCount = 0;
  } else {
    result.portfolioCount = result.portfolioItems.length;
  }
  result.catalogCount = content.includes("Project Catalog") && !content.includes("0 projects") ? 1 : 0;
  result.hasVideo = content.includes("video") && content.includes("watch video") && !content.includes("No video");
  return result;
}

/**
 * Scrape Mostaql Profile + Portfolio Page
 */
async function scrapeMostaql(url: string): Promise<ExtractedProfileData> {
  const usernameMatch = url.match(/mostaql\.com\/u\/([^/?#]+)/i);
  const username = usernameMatch ? usernameMatch[1] : "";
  if (!username) {
    throw new Error("لم يتم العثور على اسم المستخدم في رابط مستقل المقدم.");
  }

  const portfolioUrl = `https://mostaql.com/u/${username}/portfolio`;
  const profileUrl = `https://mostaql.com/u/${username}`;

  let portfolioHtml = "";
  let profileHtml = "";

  // 1. Fetch /portfolio first because Mostaql exposes the full profile, bio, skills, and portfolio projects on this page
  try {
    const portRes = await fetch(portfolioUrl, { headers: BROWSER_HEADERS });
    if (portRes.ok) {
      portfolioHtml = await portRes.text();
    }
  } catch (err: any) {
    console.warn("[Mostaql Scraper] Portfolio fetch error:", err.message);
  }

  // 2. Try fetching profile page as supplemental source if available
  try {
    const profRes = await fetch(profileUrl, { headers: BROWSER_HEADERS });
    if (profRes.ok) {
      const text = await profRes.text();
      if (text.length > 500) profileHtml = text;
    }
  } catch { }

  const sourceHtml = portfolioHtml && portfolioHtml.length > 500 ? portfolioHtml : profileHtml;

  if (!sourceHtml || sourceHtml.length < 500) {
    // Only attempt Jina if direct HTML fetch completely failed
    try {
      const jinaPort = await fetch(`https://r.jina.ai/${portfolioUrl}`, {
        headers: { Accept: "text/plain" },
      });
      if (jinaPort.ok) {
        const text = await jinaPort.text();
        if (text.length > 300 && !text.includes("403 Forbidden")) {
          return extractProfileFromRawText(`Platform: Mostaql\n${text}`);
        }
      }
    } catch { }

    throw new Error("تعذر جلب صفحة بروفايل مستقل. يرجى التأكد من صحة الرابط أو رفع ملف PDF أو لصق النص يدوياً.");
  }

  const $ = cheerio.load(sourceHtml);

  // 0. Extract Mostaql Avatar
  let avatarUrl: string | undefined = undefined;
  const avatarImgSrc = $(
    "img.profile-avatar, img.uavatar, img[src*='avatars.hsoubcdn.com'], img[src*='hsoubcdn.com/users'], .profile-card__avatar img, .user-avatar img"
  )
    .first()
    .attr("src");

  if (avatarImgSrc) {
    avatarUrl = avatarImgSrc.startsWith("//") ? `https:${avatarImgSrc}` : avatarImgSrc;
  } else {
    avatarUrl = extractAvatarFromText(sourceHtml);
  }

  // 1. Full Name
  const fullName = $("h1").first().text().replace(/\s+/g, " ").trim() || "مستقل محترف";

  // 2. Headline / Speciality
  const headline =
    $(".profile-title a, .profile-title, .user-speciality, .profile-card__job, .speciality")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim() || "مطور برمجيات مستقل";

  // 3. Bio
  let bio = $("#about_content .carda__content, #about_content, #profile-about, .profile-about")
    .first()
    .text()
    .replace(/\s+/g, " ")
    .trim();

  if (!bio) {
    $("h2, h3").each((_, el) => {
      if ($(el).text().includes("نبذة عني")) {
        const bodyText = $(el).closest(".card, .carda, div").find(".carda__body, p").text().trim();
        if (bodyText) bio = bodyText;
      }
    });
  }

  // 4. Skills
  const skills: string[] = [];
  $("#user_skills a.tag, #user_skills bdi, ul.skills li, .skills-list a, .skills-list span").each(
    (_, el) => {
      const s = $(el).text().trim();
      if (s && s !== "مهاراتي" && !skills.includes(s)) skills.push(s);
    }
  );

  // 5. Portfolio Items
  const projectUrls: string[] = [];
  $('a[href*="/portfolio/"]').each((_, el) => {
    let href = $(el).attr("href") || "";
    if (
      !href ||
      href.endsWith("/portfolio") ||
      href.endsWith(`/${username}`) ||
      href.includes("keyword=")
    ) {
      return;
    }
    if (href.startsWith("/")) href = `https://mostaql.com${href}`;
    if (!projectUrls.includes(href)) projectUrls.push(href);
  });

  const portfolioItems: ExtractedPortfolioItem[] = [];

  // Fetch individual project pages (up to 8 projects) to enrich title, description, skills and live links
  for (const pUrl of projectUrls.slice(0, 8)) {
    try {
      const pRes = await fetch(encodeURI(pUrl), { headers: BROWSER_HEADERS });
      if (pRes.ok) {
        const pHtml = await pRes.text();
        const $p = cheerio.load(pHtml);

        const title = $p("h1").first().text().trim() || "مشروع في سابقة الأعمال";
        const desc =
          $p(".text-wrapper-div, .project-desc, .portfolio-desc")
            .first()
            .text()
            .replace(/\s+/g, " ")
            .trim() || title;

        const pSkills: string[] = [];
        $p(".skills a, .tags a, .tag, a.label").each((_, sel) => {
          const t = $p(sel).text().trim();
          if (t && !pSkills.includes(t)) pSkills.push(t);
        });

        const liveUrl =
          $p('a[href^="http"]:not([href*="mostaql.com"]):not([href*="hsoub.com"])')
            .first()
            .attr("href") || null;

        portfolioItems.push({
          title,
          description: desc,
          project_url: liveUrl || pUrl,
          skills: pSkills.length > 0 ? pSkills : skills.slice(0, 6),
          category: inferProjectCategory(title, desc, pSkills),
        });
      }
    } catch (err: any) {
      console.warn(`[Mostaql Scraper] Error reading project ${pUrl}:`, err.message);
    }
  }

  // Fallback: If individual project pages couldn't be loaded, extract from main card links
  if (portfolioItems.length === 0 && projectUrls.length > 0) {
    $('a[href*="/portfolio/"]').each((_, el) => {
      let href = $(el).attr("href") || "";
      if (
        !href ||
        href.endsWith("/portfolio") ||
        href.endsWith(`/${username}`) ||
        href.includes("keyword=")
      ) {
        return;
      }
      if (href.startsWith("/")) href = `https://mostaql.com${href}`;
      const title = $(el).text().replace(/\s+/g, " ").trim();
      if (title && !portfolioItems.some((i) => i.project_url === href)) {
        portfolioItems.push({
          title,
          description: title,
          project_url: href,
          skills: skills.slice(0, 5),
          category: inferProjectCategory(title, title, skills),
        });
      }
    });
  }

  return {
    fullName,
    headline,
    bio: bio || `مطور برمجيات مستقل متخصص في ${skills.slice(0, 4).join(" و ")}.`,
    skills,
    portfolioItems,
    avatarUrl,
  };
}

/**
 * Scrape Khamsat Profile & Services
 */
async function scrapeKhamsat(url: string): Promise<ExtractedProfileData> {
  const usernameMatch = url.match(/khamsat\.com\/user\/([^/?#]+)/i);
  const username = usernameMatch ? usernameMatch[1] : "";
  const profileUrl = `https://khamsat.com/user/${username}`;

  let html = "";
  try {
    const res = await fetch(profileUrl, { headers: BROWSER_HEADERS });
    if (res.ok) html = await res.text();
  } catch (e) {
    console.warn("[Khamsat Scraper] Direct fetch error:", e);
  }

  if (!html || html.length < 200) {
    try {
      const jinaRes = await fetch(`https://r.jina.ai/${profileUrl}`, {
        headers: { Accept: "text/plain" },
      });
      if (jinaRes.ok) html = await jinaRes.text();
    } catch { }
  }

  let textContext = "";
  let avatarUrl: string | undefined = undefined;

  if (html.includes("<html") || html.includes("<body")) {
    const $ = cheerio.load(html);
    const name = $(".user-details h1, .user-name, h1").first().text().trim();
    const bio = $(".user-bio, .profile-description, #user-brief").text().trim();
    const services: any[] = [];
    $(".service-card, .service-item, .card").each((_, el) => {
      const sTitle = $(el).find("h3, .service-title, a").first().text().trim();
      const sLink = $(el).find("a").first().attr("href") || "";
      if (sTitle) services.push({ title: sTitle, link: sLink });
    });

    const avatarImg = $(
      "img.avatar, img.user-avatar, img[src*='avatars.hsoubcdn.com'], .avatar img, .user-avatar img"
    )
      .first()
      .attr("src");
    if (avatarImg) {
      avatarUrl = avatarImg.startsWith("//") ? `https:${avatarImg}` : avatarImg;
    }

    textContext = `
Platform: Khamsat
Name: ${name}
Bio: ${bio}
Offered Services & Works:
${services.map((s, i) => `${i + 1}. Title: ${s.title} (${s.link})`).join("\n")}
Raw text: ${$("body").text().slice(0, 3000)}
`.trim();
  } else {
    textContext = `Platform: Khamsat\n${html.slice(0, 5000)}`;
  }

  if (!avatarUrl) {
    avatarUrl = extractAvatarFromText(html);
  }

  const result = await extractProfileFromRawText(textContext);
  if (avatarUrl) result.avatarUrl = avatarUrl;
  return result;
}

/**
 * Scrape Nafathly Profile & Portfolio
 */
async function scrapeNafezly(url: string): Promise<ExtractedProfileData> {
  const usernameMatch = url.match(/nafezly\.com\/u\/([^/?#]+)/i);
  const username = usernameMatch ? usernameMatch[1] : "";
  const profileUrl = `https://nafezly.com/u/${username}`;

  let html = "";
  try {
    const res = await fetch(profileUrl, { headers: BROWSER_HEADERS });
    if (res.ok) html = await res.text();
  } catch (e) {
    console.warn("[Nafezly Scraper] Direct fetch error:", e);
  }

  if (!html || html.length < 200) {
    try {
      const jinaRes = await fetch(`https://r.jina.ai/${profileUrl}`);
      if (jinaRes.ok) html = await jinaRes.text();
    } catch { }
  }

  let textContext = "";
  let avatarUrl: string | undefined = undefined;

  if (html.includes("<html") || html.includes("<body")) {
    const $ = cheerio.load(html);
    const name = $("h1").first().text().trim();
    const bio = $(".user-bio, .about-me, p").text().trim();
    const avatarImg = $(
      "img.user-avatar, img.avatar, .profile-avatar img, img[src*='nafezly.com/uploads']"
    )
      .first()
      .attr("src");
    if (avatarImg) {
      avatarUrl = avatarImg.startsWith("//") ? `https:${avatarImg}` : avatarImg;
    }

    textContext = `
Platform: Nafezly
Name: ${name}
Bio: ${bio}
Body: ${$("body").text().slice(0, 4000)}
`.trim();
  } else {
    textContext = `Platform: Nafezly\n${html.slice(0, 5000)}`;
  }

  if (!avatarUrl) {
    avatarUrl = extractAvatarFromText(html);
  }

  const result = await extractProfileFromRawText(textContext);
  if (avatarUrl) result.avatarUrl = avatarUrl;
  return result;
}

/**
 * Scrape GitHub Profile & Repositories
 */
async function scrapeGitHub(url: string): Promise<ExtractedProfileData> {
  const usernameMatch = url.match(/github\.com\/([^/?#]+)/i);
  const username = usernameMatch ? usernameMatch[1] : "";

  let userJson: any = null;
  let reposJson: any[] = [];

  try {
    const [uRes, rRes] = await Promise.all([
      fetch(`https://api.github.com/users/${username}`, {
        headers: { "User-Agent": "PingLead-Portfolio-Importer" },
      }),
      fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=10`, {
        headers: { "User-Agent": "PingLead-Portfolio-Importer" },
      }),
    ]);

    if (uRes.ok) userJson = await uRes.json();
    if (rRes.ok) reposJson = await rRes.json();
  } catch (err) {
    console.warn("[GitHub API] fetch error:", err);
  }

  if (userJson) {
    const rawContext = `
Platform: GitHub
Full Name: ${userJson.name || userJson.login}
Headline / Bio: ${userJson.bio || "Software Engineer & Open Source Developer"}
Location: ${userJson.location || ""}
Company: ${userJson.company || ""}
Blog / Website: ${userJson.blog || ""}
Top Public Repositories (Portfolio Projects):
${reposJson
        .filter((r) => !r.fork)
        .map(
          (r, i) =>
            `${i + 1}. Title: ${r.name}\n   Description: ${r.description || "No description"}\n   Stars: ${r.stargazers_count}\n   Language: ${r.language || ""}\n   URL: ${r.html_url}`
        )
        .join("\n\n")}
`.trim();

    const result = await extractProfileFromRawText(rawContext);
    if (userJson.avatar_url) {
      result.avatarUrl = userJson.avatar_url;
    }
    return result;
  }

  // Fallback to Jina if API hit rate limits
  try {
    const jinaRes = await fetch(`https://r.jina.ai/${url}?tab=repositories`);
    if (jinaRes.ok) {
      const text = await jinaRes.text();
      const ghAvatar = extractAvatarFromText(text);
      const result = await extractProfileFromRawText(`Platform: GitHub\n${text.slice(0, 5000)}`);
      if (ghAvatar) result.avatarUrl = ghAvatar;
      return result;
    }
  } catch { }

  throw new Error("تعذر قراءة بيانات حساب GitHub. يرجى التحقق من صحة الرابط.");
}

/**
 * Scrape Generic Profile URL
 */
async function scrapeGenericUrl(url: string): Promise<ExtractedProfileData> {
  let content = "";
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS });
    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);
      $("script, style, noscript, nav, footer").remove();
      content = $("body").text().replace(/\s+/g, " ").trim().slice(0, 6000);
    }
  } catch { }

  if (!content || content.length < 100) {
    try {
      const jina = await fetch(`https://r.jina.ai/${url}`);
      if (jina.ok) content = await jina.text();
    } catch { }
  }

  const genericAvatar = extractAvatarFromText(content);
  const result = await extractProfileFromRawText(`Profile Web Page Content:\n${content.slice(0, 6000)}`);
  if (genericAvatar) result.avatarUrl = genericAvatar;
  return result;
}

/**
 * Extract structured profile data from raw text using Gemini
 */
export async function extractProfileFromRawText(
  rawText: string
): Promise<ExtractedProfileData> {
  const avatarFromText = extractAvatarFromText(rawText);
  const promptText = `
You are an expert talent scout and portfolio parser.
Analyze this raw freelance profile, resume, or portfolio text and extract structured data.

Extract:
1. "fullName": The freelancer's full name (if not mentioned, infer from context or return "مستقل محترف").
2. "headline": A professional headline / title (e.g., "Full-Stack Next.js & Python Engineer").
3. "bio": A comprehensive, persuasive bio/overview explaining their skills, value, and experience.
4. "hourlyRate": Hourly rate if mentioned (e.g., "$45/hr"), or null.
6. "portfolioItems": Array of real published portfolio projects or completed client contracts explicitly listed in the text.
   CRITICAL RULE FOR PORTFOLIO ITEMS (STRICT NO-HALLUCINATION POLICY):
   - ONLY extract projects that are EXPLICITLY and ACTUALLY listed in the portfolio section or completed contracts in work history.
   - If the profile or text has NO portfolio projects, NO completed client contracts, or if the portfolio is empty (e.g., shows "0 items", "No portfolio items yet", "has not published any portfolio", or has no project cards):
     YOU MUST RETURN AN EMPTY ARRAY: "portfolioItems": []
   - STRICTLY FORBIDDEN: DO NOT invent, hallucinate, imagine, or synthesize any projects from the bio, headline, skills, or employment! NEVER CREATE FAKE PROJECTS. If no explicit projects are displayed in the text, "portfolioItems" MUST be an empty array [].

Respond STRICTLY with this JSON schema:
{
  "fullName": string,
  "headline": string,
  "bio": string,
  "hourlyRate": string,
  "skills": string[],
  "portfolioItems": [
    {
      "title": string,
      "description": string,
      "project_url": string | null,
      "skills": string[]
    }
  ]
}

Raw Text Content:
${rawText}
`.trim();

  const contents = [
    {
      parts: [{ text: promptText }],
    },
  ];

  const result = await callGemini(contents);
  const normalized = normalizeExtractedData(result);
  if (avatarFromText && !normalized.avatarUrl) {
    normalized.avatarUrl = avatarFromText;
  }
  return normalized;
}

/**
 * Normalize and validate extracted profile data
 */
function normalizeExtractedData(data: any): ExtractedProfileData {
  const fullName = (data?.fullName || "مستقل محترف").trim();
  const headline = (data?.headline || "Senior Specialist").trim();
  const bio = (data?.bio || "").trim();
  const hourlyRate = data?.hourlyRate ? String(data.hourlyRate).trim() : undefined;
  const skills = Array.isArray(data?.skills)
    ? data.skills.map((s: any) => String(s).trim()).filter(Boolean)
    : [];

  const rawItems = Array.isArray(data?.portfolioItems) ? data.portfolioItems : [];
  const portfolioItems: ExtractedPortfolioItem[] = rawItems
    .map((item: any) => {
      const title = (item?.title || "").trim();
      const description = (item?.description || title).trim();
      const itemSkills = Array.isArray(item?.skills)
        ? item.skills.map((s: any) => String(s).trim()).filter(Boolean)
        : [];
      const project_url =
        item?.project_url && typeof item.project_url === "string" && item.project_url.startsWith("http")
          ? item.project_url.trim()
          : null;

      return {
        title,
        description,
        project_url,
        skills: itemSkills,
        category: inferProjectCategory(title, description, itemSkills),
      };
    })
    .filter((item: ExtractedPortfolioItem) => item.title.length > 0);

  const avatarUrl =
    data?.avatarUrl && typeof data.avatarUrl === "string" && data.avatarUrl.startsWith("http")
      ? data.avatarUrl.trim()
      : undefined;

  return {
    fullName,
    headline,
    bio,
    hourlyRate,
    skills,
    portfolioItems,
    avatarUrl,
  };
}

/**
 * Run comprehensive Profile Audit for Upwork using Gemini matching Vollna Review Standard
 */
export async function auditUpworkProfileWithAi(params: {
  pdfBuffer?: Buffer;
  profileData?: ExtractedProfileData;
  rawText?: string;
  platformType?: string;
}): Promise<VollnaProfileAuditResult> {
  const auditSystemInstruction = `
You are an elite, world-class Freelance Profile Strategist and Talent Consultant (Vollna & Upwork Top Rated Plus Talent Auditor).
Your evaluation MUST strictly follow the objective standards and exact JSON format of Vollna Profile Reviews.
DO NOT flatter or give gratuitously high scores! Be objectively realistic, analytical, and tailored strictly to the candidate's actual profile details.

CRITICAL EVALUATION RULES:
1. OVERALL SCORE OBJECTIVITY (Deterministic Weights from 100 points):
   - Vollna never gives high scores (e.g. 80%+) to incomplete profiles. Profiles missing portfolios, catalogs, or key sections receive lower, realistic scores based on completeness.
   - Strict criteria:
     * Market Proof & Completeness (20 pts): Deduct points if Portfolio is empty (0 items) or Project Catalog is missing (0 packages).
     * Skills Utilization (15 pts): Upwork allows 20 skills. Using fewer relevant skills yields proportionally lower points.
     * Employment & Experience Depth (15 pts): Evaluate depth and relevance of employment history. Single or missing entries receive lower scores.
     * Overview Structure & Client-Centricity (20 pts): Opening with freelancer-focused statements (e.g., "I am...", "As a dedicated...") instead of client-hook outcomes deducts points.
     * Title Clarity & Niche Focus (15 pts): Splitting intent across unrelated niches or vague titles deducts points; clear high-intent niche titles score higher.
     * Image & Video (15 pts): Missing video introduction deducts points. Professional photo scores higher.

2. EXECUTIVE SUMMARY:
   - Provide a precise diagnostic paragraph explicitly referencing the candidate's actual extracted metrics (total jobs, hours, rate, active contracts).
   - Identify the most critical gaps holding back search impressions and conversion based strictly on their actual profile data (e.g., empty portfolio, unutilized skill slots, brief employment entries, or overview phrasing).

3. SUGGESTED OVERVIEW STRUCTURE:
   - Hook: First line earns the scroll. Focus on client business outcomes tailored to the candidate's specific niche and skills.
   - Unique value: What only they bring based on their actual background.
   - How you help: 4 distinct bullets detailing tangible deliverables relevant to their domain.
   - Proof: 2-3 bullets featuring concrete credentials (the candidate's actual degrees, certifications, or past professional experience).
   - Call to action: Direct, low-friction next step.

4. SKILLS SECTION:
   - usedSlots: exact number of current skills extracted from the candidate.
   - maxSlots: 20
   - currentSkills: list of existing skills in their exact order of appearance.
   - analysis: Detailed explanation of their current skill selection, whether they effectively utilize the 20 available slots, and how aligned they are with their stated title.
   - skillsToAdd: High-intent, in-demand skills tailored to their specific niche to fill remaining slots up to 20.
   - skillsToReorder: Array of recommended reorders with fromRank and toRank to place primary search keywords at the top.

5. PORTFOLIO SECTION:
   - currentCount: actual count from profile.
   - alertTitle: "No portfolio items yet" (if 0) or appropriate title matching their count.
   - alertMessage: Diagnostic feedback on portfolio strength.
   - projectIdeas: 2-3 detailed project ideas tailored to their niche with "title", "description", and "whyItWorks".

6. EXPERIENCE SECTION:
   - alertTitle: Diagnostic title (e.g., "Attention needed" if 0-1 entries, or "Solid experience foundation").
   - alertMessage: Context-aware feedback on their experience depth.
   - rolesToAdd: Array of recommended roles or experience categories relevant to their niche.
   - employmentHistoryNote: Diagnostic note on their current employment entries and active contracts.
   - employmentRewrites: Detailed rewrite of their actual role(s) with recommendedTitle, recommendedDescription, and whyItWorks highlighting keyword relevance and client outcomes.
   - suggestedAdditions: Suggested credential or project additions tailored to their profession.

7. VIDEO SECTION:
   - hasVideo: boolean (false if none).
   - analysis: Objective analysis of video presence.
   - scriptSections: 3 timed sections: "Hook (0-10s)", "Value & Proof (10-35s)", "Call to Action (35-45s)" tailored to their name and niche.

8. CATALOG SECTION:
   - currentCount: actual count.
   - infoBanner: "Catalogs surface your profile on Upwork's product listing page, a second entry point for views, messages, and invites."
   - alertTitle: Appropriate title matching count.
   - alertMessage: Practical advice on project catalogs.
   - projectIdeas: 2-3 productized service ideas starting with "You will get..." with description and rationale matching their specific specialty.

Respond STRICTLY with this JSON schema:
{
  "freelancerName": string,
  "currentTitle": string,
  "avatarUrl": string | null,
  "overallScore": number,
  "executiveSummary": string,
  "stats": {
    "totalJobs": string,
    "totalHours": string,
    "hourlyRate": string,
    "activeContracts": string[]
  },
  "sections": {
    "title": {
      "status": "warning" | "good" | "critical",
      "currentText": string,
      "analysis": string,
      "suggestions": [
        { "label": string, "subtitle": string, "content": string }
      ]
    },
    "image": {
      "status": "warning" | "good" | "critical",
      "analysis": string
    },
    "overview": {
      "status": "warning" | "good" | "critical",
      "currentText": string,
      "wordCount": number,
      "charCount": number,
      "suggestedStructure": [
        { "id": "hook" | "unique_value" | "how_you_help" | "proof" | "cta", "title": string, "subtitle": string, "content": string, "bullets": string[] }
      ],
      "fullRewrittenOverview": string
    },
    "skills": {
      "status": "warning" | "good" | "critical",
      "usedSlots": number,
      "maxSlots": 20,
      "currentSkills": string[],
      "analysis": string,
      "skillsToAdd": string[],
      "skillsToReorder": [
        { "skill": string, "fromRank": number, "toRank": number }
      ]
    },
    "portfolio": {
      "status": "warning" | "good" | "critical",
      "currentCount": number,
      "alertTitle": string,
      "alertMessage": string,
      "projectIdeas": [
        { "title": string, "description": string, "whyItWorks": string }
      ]
    },
    "experience": {
      "status": "warning" | "good" | "critical",
      "alertTitle": string,
      "alertMessage": string,
      "rolesToAdd": [
        { "title": string, "description": string }
      ],
      "employmentHistoryNote": string,
      "employmentRewrites": [
        { "currentRole": string, "company": string, "recommendedTitle": string, "recommendedDescription": string, "whyItWorks": string }
      ],
      "suggestedAdditions": [
        { "type": string, "title": string, "description": string }
      ]
    },
    "video": {
      "status": "warning" | "good" | "critical",
      "hasVideo": boolean,
      "analysis": string,
      "scriptSections": [
        { "title": string, "content": string }
      ]
    },
    "catalog": {
      "status": "warning" | "good" | "critical",
      "currentCount": number,
      "infoBanner": string,
      "alertTitle": string,
      "alertMessage": string,
      "projectIdeas": [
        { "title": string, "description": string, "rationale": string }
      ]
    }
  }
}
`.trim();

  let contents: any[] = [];

  if (params.pdfBuffer) {
    const base64Pdf = params.pdfBuffer.toString("base64");
    contents = [
      {
        parts: [
          {
            inlineData: {
              mimeType: "application/pdf",
              data: base64Pdf,
            },
          },
          {
            text: "Perform the comprehensive Vollna Profile Audit on this attached Upwork Profile PDF document.",
          },
        ],
      },
    ];
  } else if (params.profileData) {
    const p = params.profileData;
    const profileSummary = `
Full Name: ${p.fullName || "غير متاح"}
Headline: ${p.headline || "غير متاح"}
Hourly Rate: ${p.hourlyRate || "غير متاح"}
Total Jobs Completed: ${p.totalJobs ? p.totalJobs : "غير متاح"}
Total Tracked Hours: ${p.totalHours !== undefined && p.totalHours !== "" ? p.totalHours : "غير متاح"}
Active / In-progress Contracts: ${p.activeContracts?.length ? p.activeContracts.join(", ") : "غير متاح"}
Avatar URL: ${p.avatarUrl || "None"}
Skills (in exact order, count ${p.skills?.length || 0}/20):
${p.skills?.length ? p.skills.map((s, i) => `${i + 1}. ${s}`).join("\n") : "غير متاح"}

Employment History:
${p.employmentHistory?.length ? p.employmentHistory.map(e => `- Role: ${e.title} at ${e.company}. ${e.description || ""}`).join("\n") : "غير متاح"}

Education:
${p.education?.length ? p.education.map(ed => `- ${ed.degree} at ${ed.institution}`).join("\n") : "غير متاح"}

Certifications & Diplomas:
${p.certifications?.length ? p.certifications.map(c => `- ${c.title} (${c.provider || ""})`).join("\n") : "غير متاح"}

Published Portfolio Items Count: ${p.portfolioCount !== undefined ? p.portfolioCount : (p.portfolioItems?.length || 0)}
Published Project Catalog Count: ${p.catalogCount !== undefined ? p.catalogCount : 0}
Has Video Introduction: ${p.hasVideo ? "Yes" : "No (None)"}

Overview / Bio:
${p.bio || "غير متاح"}

Projects / Case Studies:
${p.portfolioItems?.length ? p.portfolioItems.map((item, idx) => `${idx + 1}. ${item.title}: ${item.description}`).join("\n\n") : "None (0 published portfolio case studies)"}
`.trim();

    contents = [
      {
        parts: [
          {
            text: `Perform the comprehensive Vollna Profile Audit on this freelancer profile:\n\n${profileSummary}`,
          },
        ],
      },
    ];
  } else if (params.rawText) {
    contents = [
      {
        parts: [
          {
            text: `Perform the comprehensive Vollna Profile Audit on this profile text:\n\n${params.rawText}`,
          },
        ],
      },
    ];
  } else {
    throw new Error("No profile data or PDF provided for audit.");
  }

  const result = await callGemini(contents, auditSystemInstruction);

  // Normalize and ensure complete fallback structure
  const rawBio =
    result?.sections?.overview?.currentText ||
    params.profileData?.bio ||
    (typeof params.rawText === "string" ? params.rawText : "");
  const words = rawBio.trim() ? rawBio.trim().split(/\s+/).length : 0;
  const chars = rawBio.length;

  const currentTitle =
    result?.currentTitle ||
    params.profileData?.headline ||
    "مستقل محترف";

  const freelancerName =
    result?.freelancerName ||
    params.profileData?.fullName ||
    "مستقل محترف";

  const avatarUrl =
    params.profileData?.avatarUrl ||
    result?.avatarUrl ||
    (typeof params.rawText === "string" ? extractAvatarFromText(params.rawText) : null) ||
    null;

  // Calculate Deterministic Score
  const portfolioCount =
    typeof result?.sections?.portfolio?.currentCount === "number"
      ? result.sections.portfolio.currentCount
      : (params.profileData?.portfolioCount !== undefined ? params.profileData.portfolioCount : (params.profileData?.portfolioItems?.length || 0));

  const catalogCount =
    typeof result?.sections?.catalog?.currentCount === "number"
      ? result.sections.catalog.currentCount
      : (params.profileData?.catalogCount !== undefined ? params.profileData.catalogCount : 0);

  const skillsCount =
    result?.sections?.skills?.usedSlots ||
    (params.profileData?.skills?.length || 0);

  const employmentCount =
    (result?.sections?.experience?.employmentRewrites?.length || params.profileData?.employmentHistory?.length || 0);

  const hasVideo = Boolean(result?.sections?.video?.hasVideo || params.profileData?.hasVideo);

  const calculatedScore = calculateVollnaDeterministicScore({
    portfolioCount,
    catalogCount,
    skillsCount,
    employmentCount,
    bio: rawBio,
    headline: currentTitle,
    hasVideo,
    hasAvatar: Boolean(avatarUrl),
  });

  const overallScore = calculatedScore;

  // Stats block - leave empty/unspecified if missing
  const stats = {
    totalJobs: params.profileData?.totalJobs || result?.stats?.totalJobs || "",
    totalHours: params.profileData?.totalHours || result?.stats?.totalHours || "",
    hourlyRate: params.profileData?.hourlyRate || result?.stats?.hourlyRate || "",
    activeContracts: params.profileData?.activeContracts || result?.stats?.activeContracts || [],
  };

  const activeContractsCount = stats.activeContracts.length;
  const metricsParts: string[] = [];
  if (stats.totalJobs) metricsParts.push(`${stats.totalJobs} completed job(s)`);
  if (stats.totalHours) metricsParts.push(`${stats.totalHours} tracked hours`);
  if (stats.hourlyRate) metricsParts.push(`rate of ${stats.hourlyRate}`);
  if (activeContractsCount > 0) metricsParts.push(`${activeContractsCount} active contract(s)`);

  const metricsDesc = metricsParts.length > 0 ? metricsParts.join(", ") : "no public job history yet";

  const executiveSummary =
    result?.executiveSummary ||
    `Profile evaluation for ${freelancerName} (${currentTitle}): currently showing ${metricsDesc}. Key areas to optimize include completing all available skill slots (currently using ${skillsCount}/20), adding documented portfolio case studies, and ensuring your profile overview opens with a strong, client-centric value proposition.`;

  const proofBullets: string[] = [];
  if (params.profileData?.education?.length) {
    params.profileData.education.forEach((ed) => proofBullets.push(`🎓 ${ed.degree} - ${ed.institution}`));
  }
  if (params.profileData?.certifications?.length) {
    params.profileData.certifications.forEach((c) =>
      proofBullets.push(`📜 ${c.title}${c.provider ? ` (${c.provider})` : ""}`)
    );
  }
  if (params.profileData?.employmentHistory?.length) {
    params.profileData.employmentHistory.forEach((e) => proofBullets.push(`💼 ${e.title} at ${e.company}`));
  }
  if (proofBullets.length === 0) {
    proofBullets.push("🎓 Verified technical and academic background");
    proofBullets.push("💼 Hands-on experience delivering reliable, high-quality deliverables");
    proofBullets.push("⭐ Strong client commitment and clear milestone communication");
  }

  const defaultOverview =
    result?.sections?.overview?.fullRewrittenOverview ||
    `Help clients turn complex requirements into high-performing, scalable digital solutions that drive measurable business results.\n\nSpecializing in ${currentTitle} with a strong focus on clean architecture, performance, and dependable execution.\n\n• End-to-end development tailored to your specific project needs\n• Robust, maintainable code following modern industry best practices\n• Clear, consistent communication and on-time project milestones\n• Post-delivery support and flexible collaboration\n\nProof of Expertise:\n${proofBullets.join("\n")}\n\nReady to elevate your project? Send a direct message today to get started.`;

  return {
    freelancerName,
    currentTitle,
    avatarUrl,
    overallScore,
    executiveSummary,
    stats,
    sections: {
      title: {
        status: (result?.sections?.title?.status as VollnaSectionStatus) || "warning",
        currentText: result?.sections?.title?.currentText || currentTitle,
        analysis:
          result?.sections?.title?.analysis ||
          "A focused, high-intent title aligned directly with your primary service niche increases search impressions and attracts serious, high-ticket clients.",
        suggestions:
          Array.isArray(result?.sections?.title?.suggestions) &&
            result.sections.title.suggestions.length > 0
            ? result.sections.title.suggestions
            : [
              {
                label: "Primary recommendation",
                subtitle: "Clear niche & high client search intent",
                content: `${currentTitle} | Specialist & Consultant`,
              },
              {
                label: "Alternative 1",
                subtitle: "Outcome-focused title targeting client business results",
                content: `Senior ${currentTitle} | High-Impact Solutions`,
              },
              {
                label: "Alternative 2",
                subtitle: "Focused on end-to-end delivery & reliability",
                content: `${currentTitle} | End-to-End Implementation`,
              },
            ],
      },
      image: {
        status: (result?.sections?.image?.status as VollnaSectionStatus) || "good",
        analysis:
          result?.sections?.image?.analysis ||
          "Clear portrait framing with direct eye contact and good facial visibility. Keep background uncluttered and complete ID verification for maximum client trust.",
      },
      overview: {
        status: (result?.sections?.overview?.status as VollnaSectionStatus) || "warning",
        currentText: rawBio,
        wordCount: Number(result?.sections?.overview?.wordCount) || words,
        charCount: Number(result?.sections?.overview?.charCount) || chars,
        suggestedStructure:
          Array.isArray(result?.sections?.overview?.suggestedStructure) &&
            result.sections.overview.suggestedStructure.length > 0
            ? result.sections.overview.suggestedStructure
            : [
              {
                id: "hook",
                title: "Hook",
                subtitle: "First line earns the scroll.",
                content: `Help businesses turn complex requirements into high-performing, scalable solutions that drive measurable business outcomes.`,
              },
              {
                id: "unique_value",
                title: "Unique value",
                subtitle: "What only you bring.",
                content: `Specializing in ${currentTitle} with an uncompromising focus on clean architecture, reliable performance, and transparent communication.`,
              },
              {
                id: "how_you_help",
                title: "How you help",
                subtitle: "Outcomes you deliver.",
                bullets: [
                  "End-to-end execution from initial scoping to final production deployment",
                  "Robust, maintainable solutions adhering to industry best practices",
                  "Clear milestone updates and proactive problem-solving",
                  "Post-delivery verification and seamless handover documentation",
                ],
              },
              {
                id: "proof",
                title: "Proof",
                subtitle: "Evidence of results.",
                bullets: proofBullets,
              },
              {
                id: "cta",
                title: "Call to action",
                subtitle: "Make the next step easy.",
                content: "Send a direct message with a brief summary of your project, and let's discuss how we can build it together.",
              },
            ],
        fullRewrittenOverview: defaultOverview,
      },
      skills: {
        status: (result?.sections?.skills?.status as VollnaSectionStatus) || "warning",
        usedSlots: skillsCount,
        maxSlots: 20,
        currentSkills:
          Array.isArray(result?.sections?.skills?.currentSkills) &&
            result.sections.skills.currentSkills.length > 0
            ? result.sections.skills.currentSkills
            : (params.profileData?.skills?.length
              ? params.profileData.skills
              : []),
        analysis:
          result?.sections?.skills?.analysis ||
          (skillsCount < 10
            ? `Only ${skillsCount} of 20 skill slots are currently utilized. Adding targeted, in-demand keywords matching your specialty will improve your search reach and client matching.`
            : `Utilizing ${skillsCount} of 20 skill slots. Review your top skills periodically to ensure they match current high-volume client searches.`),
        skillsToAdd:
          Array.isArray(result?.sections?.skills?.skillsToAdd) &&
            result.sections.skills.skillsToAdd.length > 0
            ? result.sections.skills.skillsToAdd
            : [],
        skillsToReorder:
          Array.isArray(result?.sections?.skills?.skillsToReorder) &&
            result.sections.skills.skillsToReorder.length > 0
            ? result.sections.skills.skillsToReorder
            : [],
      },
      portfolio: {
        status: (result?.sections?.portfolio?.status as VollnaSectionStatus) || (portfolioCount === 0 ? "warning" : "good"),
        currentCount: portfolioCount,
        alertTitle: result?.sections?.portfolio?.alertTitle || (portfolioCount === 0 ? "No portfolio items yet" : `${portfolioCount} portfolio items published`),
        alertMessage:
          result?.sections?.portfolio?.alertMessage ||
          (portfolioCount === 0
            ? "Adding 2-3 strong case studies is the fastest way to increase conversion."
            : "Keep portfolio case studies updated with measurable client outcomes."),
        projectIdeas:
          Array.isArray(result?.sections?.portfolio?.projectIdeas) &&
            result.sections.portfolio.projectIdeas.length > 0
            ? result.sections.portfolio.projectIdeas
            : [
              {
                title: `Case Study & Client Deliverable in ${currentTitle}`,
                description: "Document a real-world project demonstrating problem analysis, chosen solution, key technologies, and final measurable outcomes.",
                whyItWorks: "Directly showcases your core capabilities and addresses client search intent.",
              },
              {
                title: "Production-Grade Solution & Implementation Architecture",
                description: "Showcase an end-to-end system with structured documentation, test coverage, and deployment details.",
                whyItWorks: "Demonstrates engineering maturity, attention to quality, and reliable execution.",
              },
            ],
      },
      experience: {
        status: (result?.sections?.experience?.status as VollnaSectionStatus) || (employmentCount <= 1 ? "warning" : "good"),
        alertTitle: result?.sections?.experience?.alertTitle || (employmentCount <= 1 ? "Attention needed" : "Solid experience foundation"),
        alertMessage:
          result?.sections?.experience?.alertMessage ||
          (employmentCount <= 1
            ? "Limited employment history entries detected. Adding past project roles, freelance engagements, or company positions strengthens profile credibility."
            : "Employment entries provide high-leverage relevance signals for platform search indexing."),
        rolesToAdd:
          Array.isArray(result?.sections?.experience?.rolesToAdd) &&
            result.sections.experience.rolesToAdd.length > 0
            ? result.sections.experience.rolesToAdd
            : [
              {
                title: `${currentTitle} (Freelance & Client Projects)`,
                description: "Document your independent consulting and project engagements with quantifiable client outcomes.",
              },
            ],
        employmentHistoryNote:
          result?.sections?.experience?.employmentHistoryNote ||
          (employmentCount === 0
            ? "No employment history listed. Adding verified roles or project history improves client trust."
            : `Detected ${employmentCount} employment entry. Optimizing job titles and bullet points with niche keywords will significantly boost search indexing.`),
        employmentRewrites:
          Array.isArray(result?.sections?.experience?.employmentRewrites) &&
            result.sections.experience.employmentRewrites.length > 0
            ? result.sections.experience.employmentRewrites
            : (params.profileData?.employmentHistory?.length
              ? params.profileData.employmentHistory.map((e) => ({
                currentRole: e.title,
                company: e.company,
                recommendedTitle: `${e.title} | ${currentTitle}`,
                recommendedDescription: e.description || "Delivered high-impact solutions, collaborated on technical deliverables, and maintained clean documentation and reliable execution.",
                whyItWorks: "Keeps the real job title while adding niche keywords for higher search indexing relevance.",
              }))
              : []),
        suggestedAdditions:
          Array.isArray(result?.sections?.experience?.suggestedAdditions) &&
            result.sections.experience.suggestedAdditions.length > 0
            ? result.sections.experience.suggestedAdditions
            : [
              {
                type: "Certification",
                title: "Industry certification in your primary discipline",
                description: "Adds recognized credentials supporting your domain authority and client trust.",
              },
              {
                type: "Project Showcase",
                title: "Public code repository or verifiable case study",
                description: "Provides potential clients with immediate, verifiable proof of your work.",
              },
            ],
      },
      video: {
        status: (result?.sections?.video?.status as VollnaSectionStatus) || (hasVideo ? "good" : "warning"),
        hasVideo,
        analysis:
          result?.sections?.video?.analysis ||
          (hasVideo
            ? "Your introduction video provides instant credibility and human connection."
            : "No introduction video detected. Profiles with a 30-60 second video introduction see higher invitation rates and faster hiring decisions because it establishes immediate trust and verifies communication skills."),
        scriptSections:
          Array.isArray(result?.sections?.video?.scriptSections) &&
            result.sections.video.scriptSections.length > 0
            ? result.sections.video.scriptSections
            : [
              {
                title: "Hook (0-10s)",
                content: `Hi there! I'm ${freelancerName}. I help clients build and deliver high-impact solutions as a ${currentTitle}.`,
              },
              {
                title: "Value & Proof (10-35s)",
                content: "Whether you need end-to-end development, architecture optimization, or reliable execution, I write clean, maintainable code and deliver results that align with your business goals.",
              },
              {
                title: "Call to Action (35-45s)",
                content: "If you're looking for a professional who communicates clearly and delivers reliable results on time, send me a message or invite me to your job. Let's discuss your project!",
              },
            ],
      },
      catalog: {
        status: (result?.sections?.catalog?.status as VollnaSectionStatus) || (catalogCount === 0 ? "warning" : "good"),
        currentCount: catalogCount,
        infoBanner:
          result?.sections?.catalog?.infoBanner ||
          "Catalogs surface your profile on Upwork's product listing page, a second entry point for views, messages, and invites.",
        alertTitle:
          result?.sections?.catalog?.alertTitle ||
          (catalogCount === 0 ? "No catalog projects yet" : `${catalogCount} catalog projects published`),
        alertMessage:
          result?.sections?.catalog?.alertMessage ||
          (catalogCount === 0
            ? "Adding one or two is a quick win. Start with a project idea below."
            : "Catalog packages provide fixed-scope entry points for clients seeking fast delivery."),
        projectIdeas:
          Array.isArray(result?.sections?.catalog?.projectIdeas) &&
            result.sections.catalog.projectIdeas.length > 0
            ? result.sections.catalog.projectIdeas
            : [
              {
                title: `You will get a custom solution in ${currentTitle}`,
                description: "End-to-end delivery of a tailored implementation with clean architecture, testing, and full documentation.",
                rationale: "Addresses high-volume client searches for productized, fixed-price services.",
              },
              {
                title: "You will get a comprehensive technical audit and optimization",
                description: "In-depth review of existing architecture, bottleneck analysis, and prioritized action plan with code fixes.",
                rationale: "A low-friction, high-trust entry service to convert clients into long-term retainers.",
              },
            ],
      },
    },
    platform: "upwork",
    platformType: "upwork",
  };
}

/**
 * -----------------------------------------------------------------------------
 * 2. Mostaql (مستقل) & Nafezly (نفذلي) Profile Audit Engine (RTL Arabic)
 * -----------------------------------------------------------------------------
 */
export async function auditMostaqlProfileWithAi(
  params: {
    pdfBuffer?: Buffer;
    profileData?: ExtractedProfileData;
    rawText?: string;
    platformType?: string;
  },
  platformType: "mostaql" | "nafezly" = "mostaql"
): Promise<VollnaProfileAuditResult> {
  const p = params.profileData;
  const platformName = platformType === "nafezly" ? "نفذلي" : "مستقل";

  const mostaqlSystemInstruction = `
أنت خبير واستشاري عالمي لتقييم وتطوير ملفات المستقلين على منصة ${platformName} (Mostaql / Nafezly Talent Strategist).
تقييمك يجب أن يكون واقعياً، موضوعياً، وغير مجامل إطلاقاً. ركز على معايير سوق العمل الحر العربي (العملاء في الخليج ومصر والشرق الأوسط).
أخرج التقييم بالكامل باللغة العربية الاحترافية الفصحى وبصيغة JSON الصارمة.

معايير التقييم وحساب النقاط (من 100 نقطة):
1. معرض الأعمال وسابقة الإنجاز (30 نقطة):
   - في ${platformName} العميل العربي يدخل لمعرض الأعمال أولاً قبل قراءة العرض!
   - إذا كان المعرض فارغاً (0 أعمال): يتم خصم 25 نقطة فوراً!
   - إذا كان يحتوي على أقل من 4 أعمال: يتم خصم 12 نقطة.
   - إذا كان يحتوي على 4 أعمال فأكثر مشروحة بنتائج واضحة: ينال 26-30 نقطة.
2. النبذة التعريفية وهيكلة الإقناع (25 نقطة):
   - الافتتاحية بخطّاف افتتاحي قوي (أول سطرين يركزان على حل مشاكل العميل العربي بدلاً من الافتتاحيات التقليدية مثل "أنا مهندس...").
   - القيمة التنافسية (ما يميز المستقل عن باقي المنافسين).
   - الحلول والنتائج بوضوح (Bullets).
   - سابقة الأعمال والإثبات (الشهادات والخبرات).
   - دعوة صريحة للتواصل (CTA).
3. مؤشرات الثقة والأوسمة (20 نقطة):
   - معدل إكمال المشاريع، إعادة التوظيف، توثيق الهوية، الأوسمة (مستقل ملتزم، هاتف مؤكد).
4. المسمى الوظيفي والكلمات المفتاحية (15 نقطة):
   - مسمى محدد دقيق للتصدر في بحث ${platformName}.
5. المهارات والصورة الشخصية (10 نقاط):
   - مهارات مستهدفة + صورة واضحة وموثوقة.

يجب أن يكون الرد بصيغة JSON وفق هذا المخطط الدقيق:
{
  "freelancerName": string,
  "currentTitle": string,
  "avatarUrl": string | null,
  "overallScore": number,
  "executiveSummary": string,
  "platformStats": [
    { "label": "معدل إكمال المشاريع", "value": string, "icon": "CheckCircle", "color": "text-emerald-600" },
    { "label": "إعادة التوظيف", "value": string, "icon": "TrendingUp", "color": "text-blue-600" },
    { "label": "المشاريع المكتملة", "value": string, "icon": "Briefcase", "color": "text-purple-600" },
    { "label": "معرض الأعمال", "value": string, "icon": "Layers", "color": "text-amber-600" }
  ],
  "sections": {
    "overview": {
      "status": "warning" | "good" | "critical",
      "currentText": string,
      "wordCount": number,
      "charCount": number,
      "suggestedStructure": [
        { "id": "hook", "title": "الخُطّاف الافتتاحي (Hook)", "subtitle": "أول سطرين لجذب العميل العربي وإقناعه بقراءة المزيد", "content": string },
        { "id": "unique_value", "title": "القيمة التنافسية (لماذا تختارني؟)", "subtitle": "ما يميزك عن باقي المستقلين في مجالك", "content": string },
        { "id": "how_you_help", "title": "ماذا سأقدم لمشروعك؟ (الحلول والنتائج)", "subtitle": "نقاط واضحة ومحددة تشرح ما سيتسلمه العميل", "bullets": string[] },
        { "id": "proof", "title": "سابقة الأعمال والإثبات (Proof)", "subtitle": "أرقام وخبرات وشهادات تدعم مصداقيتك", "bullets": string[] },
        { "id": "cta", "title": "الدعوة للتواصل (Call to Action)", "subtitle": "جملة ختامية تشجع العميل على مراسلتك لمناقشة مشروعه", "content": string }
      ],
      "fullRewrittenOverview": string
    },
    "title": {
      "status": "warning" | "good" | "critical",
      "currentText": string,
      "analysis": string,
      "suggestions": [
        { "label": "المسمى المقترح الأول (الأكثر تصدراً في البحث)", "subtitle": "مخصص لخوارزمية بحث مستقل المباشرة", "content": string },
        { "label": "المسمى المقترح الثاني (قائم على القيمة والنتائج)", "subtitle": "يركز على النتيجة النهائية للعميل", "content": string },
        { "label": "المسمى المقترح الثالث (تخصص دقيق وعالي القيمة)", "subtitle": "لجذب المشاريع الكبيرة والميزانيات المرتفعة", "content": string }
      ]
    },
    "portfolio": {
      "status": "warning" | "good" | "critical",
      "currentCount": number,
      "alertTitle": string,
      "alertMessage": string,
      "projectIdeas": [
        { "title": string, "description": string, "whyItWorks": string },
        { "title": string, "description": string, "whyItWorks": string },
        { "title": string, "description": string, "whyItWorks": string }
      ]
    },
    "skills": {
      "status": "warning" | "good" | "critical",
      "usedSlots": number,
      "maxSlots": 20,
      "currentSkills": string[],
      "analysis": string,
      "skillsToAdd": string[]
    },
    "trust_metrics": {
      "status": "warning" | "good" | "critical",
      "analysis": string,
      "badges": string[],
      "metrics": [
        { "name": string, "currentValue": string, "targetValue": string, "impact": string }
      ],
      "tips": string[]
    },
    "image": {
      "status": "warning" | "good" | "critical",
      "analysis": string
    }
  }
}
`.trim();

  const rawBio = p?.bio || (typeof params.rawText === "string" ? params.rawText : "");
  const words = rawBio.trim() ? rawBio.trim().split(/\s+/).length : 0;
  const chars = rawBio.length;

  // Values the scraper couldn't read are sent as "غير متاح", never as made-up numbers
  // ("100%", "5.0", "مطور ومستقل محترف") that the AI would then grade as the user's own
  const currentTitle = p?.headline || "غير متاح";
  const freelancerName = p?.fullName || "غير متاح";
  const avatarUrl = p?.avatarUrl || null;

  const portfolioCount = p?.portfolioCount ?? p?.portfolioItems?.length ?? 0;
  const completionRate = p?.stats?.completionRate || "غير متاح";
  const rehireRate = p?.stats?.rehireRate || "غير متاح";
  const onTimeDelivery = p?.stats?.onTimeDelivery || "غير متاح";
  const responseSpeed = p?.stats?.responseSpeed || "غير متاح";
  const completedProjects = p?.stats?.completedProjects ?? "غير متاح";
  const overallRating = p?.stats?.overallRating || "غير متاح";
  const badges = p?.stats?.badges || ["مستقل مسجل"];

  const promptText = `
بيانات المستقل على منصة ${platformName}:
- الاسم: ${freelancerName}
- المسمى الحالي: ${currentTitle}
- التقييم العام: ${overallRating}
- معدل إكمال المشاريع: ${completionRate}
- معدل إعادة التوظيف: ${rehireRate}
- التسليم في الموعد: ${onTimeDelivery}
- متوسط سرعة الرد: ${responseSpeed}
- المشاريع المكتملة: ${completedProjects}
- الأوسمة الحالية: ${badges.join("، ")}
- عدد الأعمال المنشورة في المعرض: ${portfolioCount}
- المهارات الحالية: ${p?.skills?.length ? p.skills.join("، ") : "غير متاح"}
- الأعمال المنشورة الحالية:
${(p?.portfolioItems || []).map((item, idx) => `${idx + 1}. ${item.title}: ${item.description}`).join("\n") || "لا توجد أعمال منشورة في المعرض"}

النبذة الحالية:
${rawBio || "غير متاح"}

ملحوظة مهمة: أي قيمة مكتوب عليها «غير متاح» معناها إننا ماقدرناش نقرأها من صفحة البروفايل، مش إنها صفر أو ضعيفة. متحكمش عليها، ومتديش نصيحة مبنية عليها.
`.trim();

  const contents = [
    {
      parts: [{ text: `قم بإجراء الفحص التقييمي الشامل لملف هذا المستقل على ${platformName}:\n\n${promptText}` }],
    },
  ];

  let result: any = null;
  try {
    result = await callGemini(contents, mostaqlSystemInstruction);
  } catch (err: any) {
    console.warn("[Mostaql Audit] Gemini error, using rich Arabic heuristic fallback:", err.message);
  }

  // Calculate Deterministic Score
  const calculatedScore = calculateMostaqlDeterministicScore({
    portfolioCount,
    completionRate,
    rehireRate,
    badges,
    skillsCount: p?.skills?.length || 0,
    bio: rawBio,
    headline: currentTitle,
    hasAvatar: Boolean(avatarUrl),
  });

  const overallScore = calculatedScore;

  // Platform Stats Bar
  const platformStats = [
    { label: "معدل إكمال المشاريع", value: completionRate, icon: "CheckCircle", color: "text-emerald-600" },
    { label: "إعادة التوظيف", value: rehireRate, icon: "TrendingUp", color: "text-blue-600" },
    { label: "المشاريع المكتملة", value: `${completedProjects} مشروع`, icon: "Briefcase", color: "text-purple-600" },
    { label: "معرض الأعمال", value: `${portfolioCount} عمل`, icon: "Layers", color: "text-amber-600" },
  ];

  const executiveSummary =
    result?.executiveSummary ||
    `بروفايل على منصة ${platformName} بمعدل إكمال مشاريع ${completionRate}، و${completedProjects} مشروع مكتمل، و${portfolioCount} أعمال منشورة في المعرض. أهم الفجوات التي تؤثر على معدل قبول عروضك وجذب العملاء في السوق العربي هي: ${
      portfolioCount < 4
        ? `قلة أعمال المعرض المنشورة (${portfolioCount} فقط بينما يُشترط وجود 4 أعمال على الأقل للتأثير وإثبات الجدارة)`
        : "الحاجة إلى تحسين الكلمات المفتاحية في معرض الأعمال"
    }، بالإضافة إلى صياغة نبذة تعريفية تخاطب احتياجات العميل العربي مباشرة وتركز على القيمة المضافة وحل المشكلات.`;

  const defaultOverview =
    result?.sections?.overview?.fullRewrittenOverview ||
    `أساعد أصحاب المشاريع والشركات الناشئة في الوطن العربي على تحويل متطلباتهم البرمجية إلى منتجات رقمية سريعة ومستقرة تحقق أهدافهم التجارية.\n\nمتخصص في تطوير التطبيقات والحلول البرمجية المتكاملة مع التركيز التام على الجودة، نظافة الكود، وسهولة الاستخدام للعميل النهائي.\n\nلماذا تختار التعامل معي لمشروعك؟\n• تسليم منضبط وفي الموعد بنسبة التزام 100% ودقة في المواعيد\n• كود منظم، موثق وسهل التطوير مستقبلاً بدون أخطاء خفية\n• دعم فني وتواصل مستمر وتحديثات دورية خلال فترة التنفيذ\n• ضمان الرضا التام وإجراء التعديلات المطلوبة حتى اعتماد المشروع بالكامل\n\nسابقة الخبرات والإثبات:\n🎓 بكالوريوس في هندسة البرمجيات مع خبرة عملية في مشاريع حية\n💼 تنفيذ وإطلاق مشاريع تقنية سابقة لعملاء في السعودية، الإمارات، ومصر\n\nجاهز لبدء مشروعك الآن؟ راسلني بتفاصيل فكرتك لنبدأ في تحويلها إلى واقع بأعلى جودة.`;

  return {
    freelancerName: result?.freelancerName || freelancerName,
    currentTitle: result?.currentTitle || currentTitle,
    avatarUrl,
    overallScore,
    executiveSummary,
    platform: platformType,
    platformType,
    platformStats,
    stats: {
      completionRate,
      rehireRate,
      onTimeDelivery,
      responseSpeed,
      completedProjects,
      portfolioCount,
      overallRating,
      badges,
    },
    sections: {
      overview: {
        status: (result?.sections?.overview?.status as VollnaSectionStatus) || (rawBio.length < 250 ? "warning" : "good"),
        currentText: rawBio,
        wordCount: Number(result?.sections?.overview?.wordCount) || words,
        charCount: Number(result?.sections?.overview?.charCount) || chars,
        suggestedStructure:
          Array.isArray(result?.sections?.overview?.suggestedStructure) &&
          result.sections.overview.suggestedStructure.length > 0
            ? result.sections.overview.suggestedStructure
            : [
                {
                  id: "hook",
                  title: "الخُطّاف الافتتاحي (Hook)",
                  subtitle: "أول سطرين لجذب العميل العربي وإقناعه بقراءة المزيد",
                  content: "أساعد الشركات وأصحاب الأعمال في العالم العربي على تحويل أفكارهم التقنية إلى حلول برمجية سريعة ومتقنة تحقق عائداً استثمارياً واضحاً.",
                },
                {
                  id: "unique_value",
                  title: "القيمة التنافسية (لماذا تختارني؟)",
                  subtitle: "ما يميزك عن بقية المستقلين في هذا المجال",
                  content: "أجمع بين فهم متطلبات السوق العربي وسرعة التنفيذ مع الالتزام التام بتسليم كود نظيف وتجربة مستخدم سلسة خالية من التعقيد.",
                },
                {
                  id: "how_you_help",
                  title: "ماذا سأقدم لمشروعك؟ (الحلول والنتائج)",
                  subtitle: "نقاط واضحة ومحددة تشرح ما يحصل عليه العميل",
                  bullets: [
                    "تطوير شامل للواجهات والأنظمة البرمجية بدقة واحترافية",
                    "ربط قواعد البيانات وتأمين البيانات وسرعة استجابة الخوادم",
                    "اختبارات مكثفة للأخطاء قبل التسليم لضمان الجاهزية للعمل الفوري",
                    "دعم فني وتواصل مستمر وتعديلات مرنة تلبي رغبتك بالكامل",
                  ],
                },
                {
                  id: "proof",
                  title: "سابقة الأعمال والإثبات (Proof)",
                  subtitle: "أرقام وخبرات حقيقية تدعم مصداقيتك",
                  bullets: [
                    "🎓 شهادة متخصصة في هندسة البرمجيات والأنظمة الحديثة",
                    "💼 سابقة تنفيذ مشاريع برمجية ناجحة لعملاء ورواد أعمال في الخليج ومصر",
                    "⭐ سجل تقييمات ممتاز والتزام بمعدل إكمال مشاريع بنسبة 100%",
                  ],
                },
                {
                  id: "cta",
                  title: "الدعوة للتواصل (Call to Action)",
                  subtitle: "جملة ختامية تشجع العميل على مراسلتك لمناقشة مشروعه",
                  content: "تفضل بمراسلتي الآن لمناقشة تفاصيل مشروعك واستلام خطة تنفيذ واضحة وتقدير زمني دقيق.",
                },
              ],
        fullRewrittenOverview: defaultOverview,
      },
      title: {
        status: (result?.sections?.title?.status as VollnaSectionStatus) || "good",
        currentText: currentTitle,
        analysis:
          result?.sections?.title?.analysis ||
          `المسمى الوظيفي الحالي يعبر عن تخصصك، ولكن يمكن تخصيصه أكثر بكلمات مفتاحية مستهدفة تتصدر بحث أصحاب المشاريع في ${platformName}.`,
        suggestions:
          Array.isArray(result?.sections?.title?.suggestions) &&
          result.sections.title.suggestions.length > 0
            ? result.sections.title.suggestions
            : [
                {
                  label: "المسمى المقترح الأول (الأكثر تصدراً في البحث)",
                  subtitle: `مخصص لخوارزمية بحث ${platformName} المباشرة`,
                  content: `${currentTitle} | مطور برمجيات وحلول رقمية متكاملة`,
                },
                {
                  label: "المسمى المقترح الثاني (قائم على القيمة والنتائج)",
                  subtitle: "يركز على النتيجة النهائية والقيمة التي يبحث عنها العميل العربي",
                  content: "مهندس برمجيات متخصص في بناء وتطوير المنتجات الرقمية للشركات والمتاجر",
                },
                {
                  label: "المسمى المقترح الثالث (تخصص دقيق وعالي القيمة)",
                  subtitle: "لجذب المشاريع الكبيرة والميزانيات المرتفعة",
                  content: "خبير برمجي متكامل | أتمتة الأنظمة وتطوير تطبيقات الويب الحديثة",
                },
              ],
      },
      portfolio: {
        status:
          (result?.sections?.portfolio?.status as VollnaSectionStatus) ||
          (portfolioCount === 0 ? "critical" : portfolioCount < 4 ? "warning" : "good"),
        currentCount: portfolioCount,
        alertTitle:
          result?.sections?.portfolio?.alertTitle ||
          (portfolioCount === 0
            ? "معرض الأعمال فارغ تماماً (-25 نقطة)"
            : portfolioCount < 4
            ? `معرض الأعمال يحتاج تعزيز (${portfolioCount} أعمال فقط)`
            : "معرض أعمال مكتمل وموثوق"),
        alertMessage:
          result?.sections?.portfolio?.alertMessage ||
          (portfolioCount === 0
            ? `في ${platformName}، العميل يدخل لمعرض الأعمال أولاً قبل قراءة العرض! إضافة 3 مشاريع مشروحة ضرورة قصوى لزيادة قبول عروضك.`
            : "إضافة مشاريع جديدة دورياً تُثبت جاهزيتك وتزيد من ظهورك في نتائج المستقلين الأكثر نشاطاً."),
        projectIdeas:
          Array.isArray(result?.sections?.portfolio?.projectIdeas) &&
          result.sections.portfolio.projectIdeas.length > 0
            ? result.sections.portfolio.projectIdeas
            : [
                {
                  title: "منصة ويب متكاملة لحجز الخدمات وإدارة الطلبات",
                  description:
                    "نظام ويب متكامل يتيح للمستخدمين استعراض الخدمات وحجز المواعيد مع لوحة تحكم إدارية تفاعلية لإدارة العملاء والمدفوعات الإلكترونية.",
                  whyItWorks: "من أكثر أنواع المشاريع طلباً من رواد الأعمال وأصحاب المتاجر في السعودية والخليج.",
                },
                {
                  title: "لوحة تحكم إحصائية وإدارة قواعد البيانات للمؤسسات",
                  description:
                    "داشبورد تفاعلي لعرض الرسوم البيانية ومؤشرات الأداء (KPIs) مع إمكانية تصدير التقارير بصيغة PDF/Excel وإدارة الصلاحيات.",
                  whyItWorks: "يثبت مهاراتك في هندسة البيانات والتطوير المتقدم للشركات التي تبحث عن حلول أعمال متطورة.",
                },
                {
                  title: "نظام أتمتة وربط الـ APIs مع منصات الدفع والتواصل",
                  description:
                    "حل برمجي لربط الأنظمة ببوابات الدفع الإلكتروني وتطبيقات المراسلة مثل WhatsApp وTelegram لإرسال إشعارات فورية وتحديثات الحالة.",
                  whyItWorks: "طلب شائع جداً ذو عائد مرتفع يعكس كفاءتك في التكاملات التقنية والأتمتة السريعة.",
                },
              ],
        currentItems: p?.portfolioItems || [],
      },
      skills: {
        status: (result?.sections?.skills?.status as VollnaSectionStatus) || "good",
        usedSlots: p?.skills?.length || 6,
        maxSlots: 20,
        currentSkills: p?.skills?.length ? p.skills : ["تطوير الويب", "برمجة", "قواعد البيانات", "حل المشكلات"],
        analysis:
          result?.sections?.skills?.analysis ||
          `المهارات المحددة في بروفايلك جيدة، ولكن إضافة مهارات تقنية شائعة البحث في ${platformName} سيرفع من معدل تلقي دعوات المشاريع الخاصة.`,
        skillsToAdd:
          Array.isArray(result?.sections?.skills?.skillsToAdd) &&
          result.sections.skills.skillsToAdd.length > 0
            ? result.sections.skills.skillsToAdd
            : [
                "تطوير الواجهات الخلفية (Backend)",
                "بناء واجهات API (RESTful APIs)",
                "ربط بوابات الدفع الإلكتروني",
                "أتمتة الأعمال وسكربتات بايثون",
                "قواعد بيانات PostgreSQL / MySQL",
                "أمن وتأمين التطبيقات",
                "تجاوب مع الهواتف الذكية (Responsive)",
              ],
        skillsToReorder: [],
      },
      trust_metrics: {
        status:
          completionRate === "100%" && badges.some((b) => b.includes("موثقة"))
            ? "good"
            : "warning",
        analysis:
          result?.sections?.trust_metrics?.analysis ||
          `معدل إكمال المشاريع لديك ${completionRate} وهو مؤشر إيجابي جداً. الاستمرار في تسليم المشاريع قبل الموعد وحصد التقييمات الإيجابية هو العامل الحاسم لتصدر صفحة المستقلين المتميزين.`,
        badges,
        metrics: [
          {
            name: "معدل إكمال المشاريع",
            currentValue: completionRate,
            targetValue: "100%",
            impact: "حاسم لظهورك في نتائج البحث الأولى واكتساب ثقة صاحب المشروع",
          },
          {
            name: "معدل إعادة التوظيف",
            currentValue: rehireRate,
            targetValue: "20%+",
            impact: "دليل عملي قوي على رضا العملاء السابقين ورغبتهم في العمل معك مجدداً",
          },
          {
            name: "التسليم في الموعد",
            currentValue: onTimeDelivery,
            targetValue: "100%",
            impact: "يبني سمعتك كمستقل ملتزم وجاد لا يضيع أوقات الشركات",
          },
          {
            name: "توثيق الهوية والحساب",
            currentValue: badges.some((b) => b.includes("موثقة")) ? "موثقة ✅" : "غير موثقة ⚠️",
            targetValue: "هوية موثقة",
            impact: "يوفر وسام الثقة الأخضر ويزيد معدل قبول عروضك بنسبة تصل إلى 80%",
          },
        ],
        tips: [
          "احرص على توثيق هويتك الوطنية فوراً إن لم تفعل، فالعميل يفضل التعاقد مع هوية مؤكدة.",
          "اطلب دائماً من العميل السعيد تقييم العمل فور تسليمه، فهذا يرفع معدل إكمال المشاريع وسرعة الترقية.",
          "في حال طرأ أي تأخير خارج عن إرادتك، تواصل مع العميل مبكراً لتعديل تاريخ التسليم بالاتفاق لتفادي المساس بنسبة التسليم في الموعد.",
        ],
      },
      image: {
        status: avatarUrl ? "good" : "warning",
        analysis:
          result?.sections?.image?.analysis ||
          (avatarUrl
            ? "الصورة الشخصية واضحة وتمنح انطباعاً أولياً بالجدية والمصداقية المهنية. يُفضل دوماً خلفية محايدة وإضاءة أمامية جيدة."
            : "لم يتم رصد صورة شخصية واضحة. إضافة صورة شخصية احترافية ترفع معدل ثقة العميل العربي وتزيد فرص التعاقد."),
      },
      // Safe fallbacks for Upwork tabs so existing components won't break
      experience: {
        status: "good",
        alertTitle: "سجل الخبرات المعتمد",
        alertMessage: "الخبرات مدعمة بالإحصائيات والمشاريع المنفذة.",
        rolesToAdd: [],
        employmentHistoryNote: "",
        employmentRewrites: [],
        suggestedAdditions: [],
      },
      video: {
        status: "good",
        hasVideo: false,
        analysis: "الفيديو ليس متطلباً في منصة مستقل.",
        scriptSections: [],
      },
      catalog: {
        status: "good",
        currentCount: 0,
        infoBanner: "",
        alertTitle: "",
        alertMessage: "",
        projectIdeas: [],
      },
    },
  };
}

/**
 * -----------------------------------------------------------------------------
 * 3. Khamsat (خمسات) Micro-Services Audit Engine (RTL Arabic)
 * -----------------------------------------------------------------------------
 */
export async function auditKhamsatProfileWithAi(params: {
  pdfBuffer?: Buffer;
  profileData?: ExtractedProfileData;
  rawText?: string;
  platformType?: string;
}): Promise<VollnaProfileAuditResult> {
  const p = params.profileData;
  const rawBio = p?.bio || (typeof params.rawText === "string" ? params.rawText : "");
  const words = rawBio.trim() ? rawBio.trim().split(/\s+/).length : 0;
  const chars = rawBio.length;

  const currentTitle = p?.headline || "غير متاح";
  const freelancerName = p?.fullName || "غير متاح";
  const avatarUrl = p?.avatarUrl || null;

  const sellerLevel = p?.stats?.sellerLevel || "غير متاح";
  const overallRating = p?.stats?.overallRating || "غير متاح";
  const clientsCount = p?.stats?.clientsCount || "غير متاح";
  const responseSpeed = p?.stats?.responseSpeed || "غير متاح";
  const gigsCount = p?.gigs?.length || p?.portfolioCount || 0;

  const khamsatSystemInstruction = `
أنت خبير واستشاري متخصص في منصة خمسات (Khamsat Micro-Services Top Strategist).
تقييمك مخصص لبيع الخدمات المصغرة ومضاعفة مبيعات البائع وزيادة متوسط قيمة الطلب (Cart Value) عبر التطويرات الذكية (Upsells) من 5$ إلى 50$+.
أخرج التقييم بالكامل باللغة العربية الاحترافية الفصحى بصيغة JSON الصارمة.

معايير التقييم وحساب النقاط (من 100 نقطة):
1. جودة وصياغة الخدمات المنشورة (35 نقطة):
   - عناوين واضحة وجذابة بصيغة خمسات الشهيرة ("سأقوم بـ ...").
   - 0 خدمات = خصم 30 نقطة فوراً!
2. تطويرات الخدمات ومضاعفة السعر (25 نقطة):
   - تطويرات ذكية تضيف قيمة حقيقية للعميل وترفع قيمة الطلب.
3. نبذة البائع وبناء الثقة والضمانات (20 نقطة):
   - صياغة نبذة تعرف بالبائع وتبني طمأنينة للمشتري الجديد.
4. رتبة البائع وسرعة الرد (20 نقطة):
   - بائع مميز / موثوق = 20، نشيط = 16، جديد = 10. سرعة الرد السريعة (< ساعة) تمنح نقاطاً كاملة.

يجب أن يكون الرد بصيغة JSON وفق هذا المخطط:
{
  "freelancerName": string,
  "currentTitle": string,
  "avatarUrl": string | null,
  "overallScore": number,
  "executiveSummary": string,
  "platformStats": [
    { "label": "الخدمات النشطة", "value": string, "icon": "ShoppingBag", "color": "text-emerald-600" },
    { "label": "التقييم العام", "value": string, "icon": "Award", "color": "text-amber-600" },
    { "label": "رتبة البائع", "value": string, "icon": "User", "color": "text-blue-600" },
    { "label": "سرعة الرد", "value": string, "icon": "Clock", "color": "text-purple-600" }
  ],
  "sections": {
    "gigs": {
      "status": "warning" | "good" | "critical",
      "currentCount": number,
      "analysis": string,
      "suggestedGigs": [
        {
          "title": string,
          "category": string,
          "price": string,
          "deliveryTime": string,
          "description": string,
          "whyItSells": string
        }
      ]
    },
    "upsells": {
      "status": "warning" | "good" | "critical",
      "analysis": string,
      "strategies": [
        {
          "gigTitle": string,
          "basePrice": string,
          "upsellTiers": [
            { "addon": string, "extraPrice": string, "extraDays": string, "pitch": string }
          ]
        }
      ]
    },
    "overview": {
      "status": "warning" | "good" | "critical",
      "currentText": string,
      "wordCount": number,
      "charCount": number,
      "suggestedStructure": [
        { "id": "hook", "title": "مقدمة الثقة للبائع", "subtitle": "سطرين لتعريف المشتري بمجال خبرتك", "content": string },
        { "id": "unique_value", "title": "ضمانات الخدمة وجودة التنفيذ", "subtitle": "ما الذي يضمن للمشتري استلام عمل متقن", "content": string },
        { "id": "how_you_help", "title": "مميزات التعامل معي", "subtitle": "سرعة التنفيذ والتعديلات والتواصل", "bullets": string[] },
        { "id": "cta", "title": "دعوة لطلب الخدمة", "subtitle": "شجع المشتري على التواصل قبل الطلب", "content": string }
      ],
      "fullRewrittenOverview": string
    },
    "trust_metrics": {
      "status": "warning" | "good" | "critical",
      "analysis": string,
      "badges": string[],
      "metrics": [
        { "name": string, "currentValue": string, "targetValue": string, "impact": string }
      ],
      "tips": string[]
    },
    "image": {
      "status": "warning" | "good" | "critical",
      "analysis": string
    }
  }
}
`.trim();

  const promptText = `
بيانات بائع خمسات:
- الاسم: ${freelancerName}
- رتبة البائع الحالية: ${sellerLevel}
- التقييم العام: ${overallRating}
- عدد المشترين/العملاء: ${clientsCount}
- سرعة الرد: ${responseSpeed}
- عدد الخدمات الحالية: ${gigsCount}
- قائمة الخدمات الحالية:
${(p?.gigs || []).map((g, i) => `${i + 1}. ${g.title} (${g.price || "5$"})`).join("\n") || "لا توجد خدمات معروضة حالياً"}

النبذة الحالية:
${rawBio || "غير متاح"}

ملحوظة مهمة: أي قيمة مكتوب عليها «غير متاح» معناها إننا ماقدرناش نقرأها من صفحة البروفايل، مش إنها صفر أو ضعيفة. متحكمش عليها، ومتديش نصيحة مبنية عليها.
`.trim();

  const contents = [
    {
      parts: [{ text: `قم بإجراء الفحص التقييمي لخدمات وبروفايل بائع خمسات:\n\n${promptText}` }],
    },
  ];

  let result: any = null;
  try {
    result = await callGemini(contents, khamsatSystemInstruction);
  } catch (err: any) {
    console.warn("[Khamsat Audit] Gemini error, using rich fallback:", err.message);
  }

  const calculatedScore = calculateKhamsatDeterministicScore({
    gigsCount,
    sellerLevel,
    responseSpeed,
    bio: rawBio,
    hasAvatar: Boolean(avatarUrl),
  });

  const overallScore = calculatedScore;

  const platformStats = [
    { label: "الخدمات النشطة", value: `${gigsCount} خدمة`, icon: "ShoppingBag", color: "text-emerald-600" },
    { label: "التقييم العام", value: overallRating, icon: "Award", color: "text-amber-600" },
    { label: "رتبة البائع", value: sellerLevel, icon: "User", color: "text-blue-600" },
    { label: "سرعة الرد", value: responseSpeed, icon: "Clock", color: "text-purple-600" },
  ];

  const executiveSummary =
    result?.executiveSummary ||
    `حساب برتبة (${sellerLevel}) على منصة خمسات بتقييم عام ${overallRating}، ولديك ${gigsCount} خدمات نشطة ومتوسط سرعة رد ${responseSpeed}. أهم الأولويات لمضاعفة أرباحك على خمسات هي: ${
      gigsCount < 3
        ? "نشر 3 إلى 5 خدمات متنوعة بصيغ بحثية دقيقة لزيادة فرص ظهورك في أقسام خمسات"
        : "إضافة تطويرات ذكية بأسعار بين 10$ و50$ لكل خدمة لرفع متوسط قيمة الطلب بدلاً من الاكتفاء بسعر 5$ الأساسي"
    }، بالإضافة إلى استهداف الترقية السريعة إلى (بائع نشيط) عبر المحافظة على التقييمات الإيجابية وسرعة الرد.`;

  return {
    freelancerName: result?.freelancerName || freelancerName,
    currentTitle: result?.currentTitle || `${sellerLevel} في خمسات`,
    avatarUrl,
    overallScore,
    executiveSummary,
    platform: "khamsat",
    platformType: "khamsat",
    platformStats,
    stats: {
      sellerLevel,
      overallRating,
      clientsCount,
      responseSpeed,
      activeServicesCount: gigsCount,
      portfolioCount: gigsCount,
    },
    sections: {
      gigs: {
        status: (result?.sections?.gigs?.status as VollnaSectionStatus) || (gigsCount === 0 ? "critical" : "good"),
        currentCount: gigsCount,
        analysis:
          result?.sections?.gigs?.analysis ||
          `لديك حالياً ${gigsCount} خدمات. زيادة عدد الخدمات المصغرة المصاغة بدقة يساعد خوارزميات خمسات على اقتراح خدماتك في نتائج البحث والخدمات ذات الصلة.`,
        currentGigs: p?.gigs || [],
        suggestedGigs:
          Array.isArray(result?.sections?.gigs?.suggestedGigs) &&
          result.sections.gigs.suggestedGigs.length > 0
            ? result.sections.gigs.suggestedGigs
            : [
                {
                  title: "سأقوم بإنشاء موقع تعريفي احترافي متجاوب وسريع لمشروعك",
                  category: "برمجة وتطوير",
                  price: "10$",
                  deliveryTime: "يومين",
                  description:
                    "أقدم لك موقعاً تعريفياً عصرياً وأنيقاً يبرز نشاطك التجاري أو خدماتك الشخصية، متوافقاً تماماً مع جميع مقاسات الشاشات والهواتف، وسريع التصفح وفق أفضل الممارسات البرمجية.",
                  whyItSells: "من أكثر الخدمات طلباً على خمسات لأصحاب الأعمال والأنشطة الناشئة.",
                },
                {
                  title: "سأقوم بتصميم وتطوير صفحة هبوط تسويقية لزيادة مبيعاتك",
                  category: "برمجة وتطوير",
                  price: "15$",
                  deliveryTime: "يوم واحد",
                  description:
                    "تصميم وبرمجة صفحة هبوط (Landing Page) تسويقية جذابة ومركزة على إقناع الزائر واتخاذ قرار الشراء، مع نموذج تواصل أو زر طلب مباشر وربط بالواتساب.",
                  whyItSells: "يحتاجها كل من يطلق إعلانات ممولة في الخليج ومصر لتحويل الزوار إلى عملاء.",
                },
                {
                  title: "سأقوم بفحص وإصلاح أخطاء ومشاكل موقعك البرمجية والتقنية",
                  category: "برمجة وتطوير",
                  price: "5$",
                  deliveryTime: "خلال 24 ساعة",
                  description:
                    "فحص شامل لموقعك أو متجرك واكتشاف أي أخطاء في الكود أو التصميم أو سرعة التحميل وإصلاحها فوراً لضمان عمل موقعك بأقصى كفاءة بدون توقف.",
                  whyItSells: "خدمة سريعة ذات سعر دخول منخفض تشجع العملاء على الطلب الفوري وفتح باب التعاقدات اللاحقة.",
                },
              ],
      },
      upsells: {
        status: "warning",
        analysis:
          result?.sections?.upsells?.analysis ||
          "الاعتماد على سعر 5$ فقط يستهلك طاقتك دون عائد مجزٍ. إضافة تطويرات متدرجة من 10$ إلى 50$ تضاعف دخلك من نفس العميل بمقدار 4 إلى 10 أضعاف.",
        strategies:
          Array.isArray(result?.sections?.upsells?.strategies) &&
          result.sections.upsells.strategies.length > 0
            ? result.sections.upsells.strategies
            : [
                {
                  gigTitle: "تطوير موقع تعريفي احترافي لمشروعك",
                  basePrice: "10$",
                  upsellTiers: [
                    {
                      addon: "إضافة 3 صفحات إضافية مفصلة مع ربط وسائل التواصل",
                      extraPrice: "+15$",
                      extraDays: "+ يوم واحد",
                      pitch: "مثالية للعميل الذي يحتاج موقعاً متكاملاً متعدد الأقسام.",
                    },
                    {
                      addon: "تهيئة الموقع لمحركات البحث (SEO) وتحسين سرعة التحميل لـ 90%+",
                      extraPrice: "+25$",
                      extraDays: "+ يوم واحد",
                      pitch: "قيمة مضافة ضخمة تجعل العميل يرى موقعة متصدراً في جوجل.",
                    },
                    {
                      addon: "دعم فني وتعديلات مجانية لمدة شهر كامل بعد التسليم",
                      extraPrice: "+35$",
                      extraDays: "0 أيام إضافية",
                      pitch: "تمنح المشتري راحة بال تامة وترفع من تقييمك وثقته بك.",
                    },
                  ],
                },
              ],
      },
      overview: {
        status: (result?.sections?.overview?.status as VollnaSectionStatus) || "good",
        currentText: rawBio,
        wordCount: Number(result?.sections?.overview?.wordCount) || words,
        charCount: Number(result?.sections?.overview?.charCount) || chars,
        suggestedStructure:
          Array.isArray(result?.sections?.overview?.suggestedStructure) &&
          result.sections.overview.suggestedStructure.length > 0
            ? result.sections.overview.suggestedStructure
            : [
                {
                  id: "hook",
                  title: "مقدمة الثقة للبائع",
                  subtitle: "سطرين لتعريف المشتري بمجال خبرتك",
                  content: "مرحباً بك! أنا متخصص في تقديم حلول برمجية وتطوير الويب بجودة متقنة ومرونة عالية تلبي رغبتك بالكامل.",
                },
                {
                  id: "unique_value",
                  title: "ضمانات الخدمة وجودة التنفيذ",
                  subtitle: "ما الذي يضمن للمشتري استلام عمل متقن",
                  content: "هدفي الأول هو رضاك التام عن الخدمة؛ لذا أضمن لك كوداً نظيفاً، سرعة في التنفيذ، وتعديلات غير محدودة حتى تكون راضياً 100%.",
                },
                {
                  id: "how_you_help",
                  title: "مميزات التعامل معي",
                  subtitle: "سرعة التنفيذ والتعديلات والتواصل",
                  bullets: [
                    "رد فوري وسريع على الرسائل والاستفسارات",
                    "تسليم قبل الموعد المحدد مع شرح كامل لطريقة الاستخدام",
                    "دعم فني مستمر بعد تسليم الطلب للإجابة عن أي سؤال",
                  ],
                },
                {
                  id: "cta",
                  title: "دعوة لطلب الخدمة",
                  subtitle: "شجع المشتري على التواصل قبل الطلب",
                  content: "يسعدني تواصلك معي قبل طلب الخدمة لأقدم لك استشارة مجانية وأفضل مقترح لتنفيذ طلبك بأعلى جودة.",
                },
              ],
        fullRewrittenOverview:
          result?.sections?.overview?.fullRewrittenOverview ||
          `أهلاً بك في حسابي الرسمي على خمسات!\n\nمتخصص في تقديم خدمات برمجية وتطوير الويب بخبرة حقيقية واهتمام بأدق التفاصيل. أحرص دائماً على أن تكون كل خدمة أقدمها إضافة حقيقية لعملائي، مع التركيز على السرعة، الأناقة، والاستقرار التقني.\n\nلماذا تطلب خدماتي بثقة؟\n• دقة في المواعيد وتسليم في الوقت المحدد بدون تأخير\n• تعديلات مستمرة حتى الرضا التام واعتماد الطلب\n• دعم فني وتواصل سريع للإجابة على كل استفساراتك\n\nتفضل بمراسلتي في أي وقت وسأكون سعيداً بخدمتك!`,
      },
      trust_metrics: {
        status: sellerLevel.includes("مميز") || sellerLevel.includes("نشيط") ? "good" : "warning",
        analysis:
          result?.sections?.trust_metrics?.analysis ||
          `رتبتك الحالية هي (${sellerLevel}). الوصول إلى رتبة (بائع نشيط) يتطلب إكمال 10 طلبات ناجحة بتقييم 5 نجوم وسرعة رد عالية، وهو ما يفتح لك باب بيع تطويرات حتى 100$ وظهور خدماتك في الصفحة الأولى.`,
        badges: [sellerLevel],
        metrics: [
          {
            name: "التقييم العام",
            currentValue: String(overallRating),
            targetValue: "100%",
            impact: "العامل الأساسي في قرار الشراء لدى عملاء خمسات",
          },
          {
            name: "رتبة البائع",
            currentValue: sellerLevel,
            targetValue: "بائع مميز",
            impact: "زيادة الحد الأقصى لتطويرات الخدمات وفتح ميزات حصرية",
          },
          {
            name: "سرعة الرد على الرسائل",
            currentValue: responseSpeed,
            targetValue: "خلال ساعة",
            impact: "الرد السريع يحسم بيع 70% من الطلبات قبل أن يتوجه العميل لبائع آخر",
          },
        ],
        tips: [
          "احرص على فتح إشعارات تطبيق خمسات أو البريد لتجيب على رسائل المشترين في الدقائق الأولى.",
          "قدّم دائماً قيمة إضافية صغيرة فوق الخدمة المطلوبة، فهذا يضمن لك تقييم 5 نجوم وكتابة مراجعة مديح إيجابية.",
          "شجع العملاء دائماً على مراسلتك قبل الطلب لتحدد معهم التطوير المناسب وترفع قيمة الطلب بسلاسة.",
        ],
      },
      image: {
        status: avatarUrl ? "good" : "warning",
        analysis:
          result?.sections?.image?.analysis ||
          "الهوية البصرية لحسابك ولصور الخدمات (Thumbnails) تلعب دوراً جوهرياً في زيادة نسبة النقر (CTR). احرص على صور خدمات بأبعاد 800x470 بدقة عالية وبدون نصوص مزدحمة.",
      },
      // Safe fallbacks for Upwork tabs
      title: {
        status: "good",
        currentText: currentTitle,
        analysis: "",
        suggestions: [],
      },
      portfolio: {
        status: "good",
        currentCount: gigsCount,
        alertTitle: "",
        alertMessage: "",
        projectIdeas: [],
      },
      skills: {
        status: "good",
        usedSlots: 5,
        maxSlots: 20,
        currentSkills: [],
        analysis: "",
        skillsToAdd: [],
        skillsToReorder: [],
      },
      experience: {
        status: "good",
        alertTitle: "",
        alertMessage: "",
        rolesToAdd: [],
        employmentHistoryNote: "",
        employmentRewrites: [],
        suggestedAdditions: [],
      },
      video: {
        status: "good",
        hasVideo: false,
        analysis: "",
        scriptSections: [],
      },
      catalog: {
        status: "good",
        currentCount: gigsCount,
        infoBanner: "",
        alertTitle: "",
        alertMessage: "",
        projectIdeas: [],
      },
    },
  };
}

/**
 * -----------------------------------------------------------------------------
 * Universal Platform-Adaptive Profile Audit Dispatcher
 * Dispatches to Upwork, Mostaql / Nafezly, or Khamsat while keeping Upwork 100% intact!
 * -----------------------------------------------------------------------------
 */
export async function auditProfileWithAi(params: {
  pdfBuffer?: Buffer;
  profileData?: ExtractedProfileData;
  rawText?: string;
  platformType?: string;
}): Promise<VollnaProfileAuditResult> {
  let detectedPlatform = params.platformType;

  if (!detectedPlatform) {
    if (params.pdfBuffer) {
      detectedPlatform = "upwork";
    } else if (params.profileData?.platformType) {
      detectedPlatform = params.profileData.platformType;
    } else if (params.profileData?.sourceUrl) {
      const lower = params.profileData.sourceUrl.toLowerCase();
      if (lower.includes("mostaql.com")) detectedPlatform = "mostaql";
      else if (lower.includes("khamsat.com")) detectedPlatform = "khamsat";
      else if (lower.includes("nafezly.com")) detectedPlatform = "nafezly";
      else if (lower.includes("upwork.com")) detectedPlatform = "upwork";
      else detectedPlatform = "custom";
    } else if (params.rawText) {
      const lowerText = params.rawText.toLowerCase();
      if (lowerText.includes("mostaql") || lowerText.includes("مستقل")) detectedPlatform = "mostaql";
      else if (lowerText.includes("khamsat") || lowerText.includes("خمسات")) detectedPlatform = "khamsat";
      else if (lowerText.includes("nafezly") || lowerText.includes("نفذلي")) detectedPlatform = "nafezly";
      else detectedPlatform = "upwork";
    } else {
      detectedPlatform = "upwork";
    }
  }

  // Branch A: Mostaql or Nafezly
  if (detectedPlatform === "mostaql" || detectedPlatform === "nafezly") {
    return auditMostaqlProfileWithAi(params, detectedPlatform);
  }

  // Branch B: Khamsat
  if (detectedPlatform === "khamsat") {
    return auditKhamsatProfileWithAi(params);
  }

  // Branch C: Upwork (Default - 100% Preserved)
  return auditUpworkProfileWithAi(params);
}
