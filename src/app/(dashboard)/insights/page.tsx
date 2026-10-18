"use client";

import { BarChart3, TrendingUp, Target, Award, ArrowUpRight } from "lucide-react";

export default function InsightsPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Vollna Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-600" />
            <span>التحليلات والمؤشرات</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            إحصائيات فورية حول مطابقة المشاريع، معدل سرعة التقديم، وأداء عروض الـ AI عبر المنصات التسع.
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="vollna-card p-5 bg-white border border-slate-200 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">إجمالي المشاريع المرصودة</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">1,248</span>
            <span className="text-xs font-semibold text-emerald-600 flex items-center">
              <TrendingUp className="w-3 h-3 ml-0.5" /> +18%
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">خلال آخر 24 ساعة عبر 9 منصات</p>
        </div>

        <div className="vollna-card p-5 bg-white border border-slate-200 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">عروض AI تم توليدها</span>
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-emerald-400 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">42</span>
            <span className="text-xs font-semibold text-slate-500">عرض مخصص</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">متوسط زمن التوليد 1.8 ثانية</p>
        </div>
      </div>
    </div>
  );
}
