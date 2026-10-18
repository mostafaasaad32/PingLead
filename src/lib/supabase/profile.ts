// ==============================================================================
// src/lib/supabase/profile.ts
// Profile Initialization & Management Helper (Guaranteeing Supabase Persistence)
// ==============================================================================

import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "./types";

export type FreelancerProfile = Database["public"]["Tables"]["freelancer_profiles"]["Row"];
export type FreelancerProfileUpdate = Database["public"]["Tables"]["freelancer_profiles"]["Update"];

/**
 * Ensures that a freelancer profile exists in Supabase.
 * If not present, automatically creates one with 25 AI credits,
 * default country 'Egypt', and timezone 'Africa/Cairo'.
 */
export async function getOrEnsureFreelancerProfile(
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  email?: string,
  fullName?: string
): Promise<FreelancerProfile | null> {
  try {
    if (!userId) return null;

    // 1. Verify session exists and email is confirmed before allowing profile insertion
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) {
      return null;
    }

    const sessionUser = sessionData.session.user;
    if (!sessionUser.email_confirmed_at && !sessionUser.confirmed_at) {
      return null;
    }

    // 2. Try to fetch existing profile
    const { data: profile, error } = await supabase
      .from("freelancer_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (profile && !error) {
      return profile;
    }

    // 3. If not found or error, create the profile
    const defaultName =
      fullName || (email ? email.split("@")[0] : "Freelancer");

    const newProfile = {
      user_id: userId,
      full_name: defaultName,
      title: "Full-Stack Specialist",
      bio: "محترف مستقل أبحث عن أفضل المشاريع لتنفيذها بأعلى معايير الجودة.",
      skills: ["React", "Next.js", "Node.js", "TypeScript"],
      tone_of_voice: "confident" as const,
      ai_credits: 25,
      country: "Egypt",
      timezone: "Africa/Cairo",
      time_format: "12h",
    };

    const { data: inserted, error: insertError } = await supabase
      .from("freelancer_profiles")
      .insert(newProfile)
      .select()
      .maybeSingle();

    if (insertError) {
      // If error was conflict (created concurrently by DB trigger), fetch it
      const { data: fallback } = await supabase
        .from("freelancer_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      return fallback;
    }

    return inserted;
  } catch (err) {
    return null;
  }
}
