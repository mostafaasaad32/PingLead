// ==============================================================================
// src/lib/filters/countries.ts
// Client countries for the filter. Platforms report the same country in different
// languages ("مصر" on Nafezly, "Egypt" on PeoplePerHour), so filters store a code and
// every known spelling maps to it.
// ==============================================================================

export interface CountryOption {
  code: string;
  label_ar: string;
  aliases: string[]; // lowercase, Arabic and English spellings
}

export const COUNTRY_OPTIONS: CountryOption[] = [
  { code: 'EG', label_ar: 'مصر', aliases: ['مصر', 'egypt'] },
  { code: 'SA', label_ar: 'السعودية', aliases: ['السعودية', 'المملكة العربية السعودية', 'saudi arabia', 'ksa'] },
  { code: 'AE', label_ar: 'الإمارات', aliases: ['الإمارات', 'الامارات', 'الإمارات العربية المتحدة', 'united arab emirates', 'uae'] },
  { code: 'KW', label_ar: 'الكويت', aliases: ['الكويت', 'kuwait'] },
  { code: 'QA', label_ar: 'قطر', aliases: ['قطر', 'qatar'] },
  { code: 'BH', label_ar: 'البحرين', aliases: ['البحرين', 'bahrain'] },
  { code: 'OM', label_ar: 'عُمان', aliases: ['عمان', 'عُمان', 'سلطنة عمان', 'oman'] },
  { code: 'JO', label_ar: 'الأردن', aliases: ['الأردن', 'الاردن', 'jordan'] },
  { code: 'LB', label_ar: 'لبنان', aliases: ['لبنان', 'lebanon'] },
  { code: 'PS', label_ar: 'فلسطين', aliases: ['فلسطين', 'palestine', 'palestinian territory'] },
  { code: 'IQ', label_ar: 'العراق', aliases: ['العراق', 'iraq'] },
  { code: 'SY', label_ar: 'سوريا', aliases: ['سوريا', 'سورية', 'syria'] },
  { code: 'MA', label_ar: 'المغرب', aliases: ['المغرب', 'morocco'] },
  { code: 'DZ', label_ar: 'الجزائر', aliases: ['الجزائر', 'algeria'] },
  { code: 'TN', label_ar: 'تونس', aliases: ['تونس', 'tunisia'] },
  { code: 'LY', label_ar: 'ليبيا', aliases: ['ليبيا', 'libya'] },
  { code: 'SD', label_ar: 'السودان', aliases: ['السودان', 'sudan'] },
  { code: 'YE', label_ar: 'اليمن', aliases: ['اليمن', 'yemen'] },
  { code: 'US', label_ar: 'أمريكا', aliases: ['الولايات المتحدة', 'أمريكا', 'امريكا', 'united states', 'usa', 'us'] },
  { code: 'GB', label_ar: 'بريطانيا', aliases: ['المملكة المتحدة', 'بريطانيا', 'united kingdom', 'uk', 'great britain', 'england'] },
  { code: 'CA', label_ar: 'كندا', aliases: ['كندا', 'canada'] },
  { code: 'AU', label_ar: 'أستراليا', aliases: ['أستراليا', 'استراليا', 'australia'] },
  { code: 'DE', label_ar: 'ألمانيا', aliases: ['ألمانيا', 'المانيا', 'germany'] },
  { code: 'FR', label_ar: 'فرنسا', aliases: ['فرنسا', 'france'] },
];

export const GULF_COUNTRY_CODES = ['SA', 'AE', 'KW', 'QA', 'BH', 'OM'];

/** Country code for a platform's country text, or null when unknown. */
export function countryCodeFor(country: string | null | undefined): string | null {
  if (!country) return null;
  const value = country.trim().toLowerCase();
  const match = COUNTRY_OPTIONS.find((c) => c.aliases.includes(value) || c.code.toLowerCase() === value);
  return match ? match.code : null;
}
