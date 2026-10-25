"use client";

// ==============================================================================
// src/components/dashboard/DashboardFilters.tsx
// Vollna-Style Full-Width CSS Grid Filters Workspace for PingLead Radar
// ==============================================================================

import React from "react";
import { Search, Clock, X, ChevronDown, Shield, Sparkles } from "lucide-react";
import { CATEGORIES_METADATA, PLATFORMS_METADATA } from "@/lib/scrapers/types";

export interface DashboardFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  selectedPlatform: string;
  setSelectedPlatform: (platform: string) => void;
  timeWindow: "24h" | "48h" | "72h";
  setTimeWindow: (w: "24h" | "48h" | "72h") => void;
  hideRiskyClients: boolean;
  setHideRiskyClients: React.Dispatch<React.SetStateAction<boolean>>;
  hasAiScores?: boolean;
  onlyAiFit?: boolean;
  setOnlyAiFit?: React.Dispatch<React.SetStateAction<boolean>>;
  totalCount?: number;
}

export default function DashboardFilters({
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  selectedPlatform,
  setSelectedPlatform,
  timeWindow,
  setTimeWindow,
  hideRiskyClients,
  setHideRiskyClients,
  hasAiScores = false,
  onlyAiFit = false,
  setOnlyAiFit,
  totalCount,
}: DashboardFiltersProps) {
  const isAnyFilterActive =
    Boolean(searchQuery) ||
    selectedCategory !== "all" ||
    selectedPlatform !== "all" ||
    timeWindow !== "24h" ||
    hideRiskyClients ||
    onlyAiFit;

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setSelectedPlatform("all");
    setTimeWindow("24h");
    setHideRiskyClients(false);
    if (setOnlyAiFit) setOnlyAiFit(false);
  };

  return (
    <div className="w-full bg-white border border-slate-200/80 rounded-xl shadow-2xs p-2.5 transition-all">
      {/* Primary Strict 4-Column CSS Grid Filters (Slim h-8 toolbar) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5 w-full">
        {/* Column 1: Search Bar (h-8 compact) */}
        <div className="relative w-full">
          <input
            type="text"
            placeholder="بحث في نصوص وعناوين المشاريع..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8 pr-8 pl-7 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500/20 transition-all font-normal"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded"
              title="مسح البحث"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Column 2: All Categories (h-8 compact) */}
        <div className="relative w-full">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full h-8 pr-2.5 pl-7 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500/20 font-medium transition-all cursor-pointer appearance-none"
          >
            <option value="all">كافة التخصصات (14 تخصصاً)</option>
            {CATEGORIES_METADATA.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.label_ar}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Column 3: All Platforms (h-8 compact) */}
        <div className="relative w-full">
          <select
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value)}
            className="w-full h-8 pr-2.5 pl-7 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500/20 font-medium transition-all cursor-pointer appearance-none"
          >
            <option value="all">كافة المنصات (9 منصات)</option>
            <optgroup label="🇪🇬🇸🇦 منصات عربية (5)">
              {PLATFORMS_METADATA.filter((p) => p.region === "arab").map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label_ar}
                </option>
              ))}
            </optgroup>
            <optgroup label="🌍 منصات عالمية (4)">
              {PLATFORMS_METADATA.filter((p) => p.region === "global").map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label_ar}
                </option>
              ))}
            </optgroup>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Column 4: Time Window Segmented Control (h-8 compact) */}
        <div className="w-full h-8 p-0.5 bg-slate-100/80 rounded-lg border border-slate-200/80 flex items-center justify-between gap-1">
          {[
            { id: "24h", label: "آخر 24 ساعة" },
            { id: "48h", label: "آخر 48 ساعة" },
            { id: "72h", label: "آخر 72 ساعة" },
          ].map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => setTimeWindow(w.id as "24h" | "48h" | "72h")}
              className={`flex-1 h-full px-1.5 text-[11px] font-medium rounded-md transition-all flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer ${
                timeWindow === w.id
                  ? "bg-white text-slate-900 shadow-2xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Clock className={`w-3 h-3 ${timeWindow === w.id ? "text-emerald-600" : "text-slate-400"}`} />
              <span>{w.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Toggles Bar (Slim compact row under the Grid) */}
      <div className="flex items-center justify-start gap-2.5 pt-2 mt-2 border-t border-slate-100 flex-wrap">
        {/* Hide Risky Clients Quick Filter */}
        <button
          type="button"
          onClick={() => setHideRiskyClients((v) => !v)}
          aria-pressed={hideRiskyClients}
          title="إخفاء كل المشاريع ذات التقييم الأقل من 6/10 والتركيز على أصحاب المشاريع الجادين فقط"
          className={`h-7 px-2.5 rounded-md text-[11px] font-medium border transition-all flex items-center gap-1.5 cursor-pointer ${
            hideRiskyClients
              ? "bg-slate-900 border-slate-900 text-white shadow-2xs"
              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
          }`}
        >
          <Shield className={`w-3 h-3 ${hideRiskyClients ? "text-emerald-400 fill-emerald-400/20" : "text-slate-500"}`} />
          <span>إخفاء العملاء الوهميين (أعلى من 6/10 فقط)</span>
          {hideRiskyClients && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ms-0.5" />
          )}
        </button>

        {/* AI Fit Filter Toggle (When AI scores are present) */}
        {hasAiScores && setOnlyAiFit && (
          <button
            type="button"
            onClick={() => setOnlyAiFit((v) => !v)}
            aria-pressed={onlyAiFit}
            title="المشاريع التي قيّمها الذكاء الاصطناعي فوق الحد المطلوب فقط"
            className={`h-7 px-2.5 rounded-md text-[11px] font-medium border transition-all flex items-center gap-1.5 cursor-pointer ${
              onlyAiFit
                ? "bg-emerald-600 border-emerald-600 text-white shadow-2xs"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
            }`}
          >
            <Sparkles className="w-3 h-3 text-amber-300" />
            <span>المناسب لشروطي بس</span>
            {onlyAiFit && (
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse ms-0.5" />
            )}
          </button>
        )}

        {/* Active Results Count */}
        {typeof totalCount === "number" && (
          <span className="text-[11px] text-slate-400 font-medium hidden sm:inline-flex items-center gap-1 ms-1">
            <span>النتائج المعروضة:</span>
            <span className="font-semibold text-slate-700">{totalCount} مشروع</span>
          </span>
        )}

        {/* Clear/Reset All Filters Button */}
        {isAnyFilterActive && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="h-7 px-2 text-[11px] font-medium text-slate-400 hover:text-rose-600 transition flex items-center gap-1 ms-auto rounded-md hover:bg-rose-50 cursor-pointer"
            title="إعادة ضبط جميع الفلاتر للوضع الافتراضي"
          >
            <X className="w-3 h-3" />
            <span>إعادة ضبط الفلاتر</span>
          </button>
        )}
      </div>
    </div>
  );
}
