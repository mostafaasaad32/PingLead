// ==============================================================================
// src/lib/supabase/types.ts
// Complete Supabase Database Type Definitions for PingLead (Vollna Architecture)
// Compatible with @supabase/supabase-js v2
// ==============================================================================

import {
  FreelancePlatform,
  ProjectCategory,
  ProjectLanguage,
  ToneOfVoice,
  ProjectActionStatus
} from '../scrapers/types';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          external_id: string;
          platform: FreelancePlatform;
          title: string;
          description: string;
          url: string;
          budget: string | null;
          budget_min: number | null;
          budget_max: number | null;
          currency: string | null;
          budget_usd_estimate: number | null;
          category: ProjectCategory;
          language: ProjectLanguage;
          author: string;
          published_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          external_id: string;
          platform: FreelancePlatform;
          title: string;
          description: string;
          url: string;
          budget?: string | null;
          budget_min?: number | null;
          budget_max?: number | null;
          currency?: string | null;
          budget_usd_estimate?: number | null;
          category: ProjectCategory;
          language?: ProjectLanguage;
          author?: string;
          published_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          external_id?: string;
          platform?: FreelancePlatform;
          title?: string;
          description?: string;
          url?: string;
          budget?: string | null;
          budget_min?: number | null;
          budget_max?: number | null;
          currency?: string | null;
          budget_usd_estimate?: number | null;
          category?: ProjectCategory;
          language?: ProjectLanguage;
          author?: string;
          published_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      freelancer_profiles: {
        Row: {
          id: string;
          user_id: string;
          full_name: string | null;
          title: string | null;
          bio: string | null;
          skills: string[];
          tone_of_voice: ToneOfVoice;
          telegram_chat_id: string | null;
          telegram_connect_token: string | null;
          ai_credits: number;
          country: string;
          timezone: string;
          time_format: string;
          notifications_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          full_name?: string | null;
          title?: string | null;
          bio?: string | null;
          skills?: string[];
          tone_of_voice?: ToneOfVoice;
          telegram_chat_id?: string | null;
          telegram_connect_token?: string | null;
          ai_credits?: number;
          country?: string;
          timezone?: string;
          time_format?: string;
          notifications_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          full_name?: string | null;
          title?: string | null;
          bio?: string | null;
          skills?: string[];
          tone_of_voice?: ToneOfVoice;
          telegram_chat_id?: string | null;
          telegram_connect_token?: string | null;
          ai_credits?: number;
          country?: string;
          timezone?: string;
          time_format?: string;
          notifications_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      proposal_templates: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          sender_name: string | null;
          hourly_rate: number | null;
          pricing_type: string;
          filter_id: string | null;
          template_body: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          sender_name?: string | null;
          hourly_rate?: number | null;
          pricing_type?: string;
          filter_id?: string | null;
          template_body?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          sender_name?: string | null;
          hourly_rate?: number | null;
          pricing_type?: string;
          filter_id?: string | null;
          template_body?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      portfolio_items: {
        Row: {
          id: string;
          user_id: string;
          project_title: string;
          description: string;
          live_url: string | null;
          tags: string[];
          category: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_title: string;
          description: string;
          live_url?: string | null;
          tags?: string[];
          category?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          project_title?: string;
          description?: string;
          live_url?: string | null;
          tags?: string[];
          category?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_filters: {
        Row: {
          id: string;
          user_id: string;
          filter_name: string;
          platforms: string[];
          categories: string[];
          include_keywords: string[];
          exclude_keywords: string[];
          min_budget_usd: number;
          is_active: boolean;
          notify_telegram: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          filter_name: string;
          platforms?: string[];
          categories?: string[];
          include_keywords?: string[];
          exclude_keywords?: string[];
          min_budget_usd?: number;
          is_active?: boolean;
          notify_telegram?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          filter_name?: string;
          platforms?: string[];
          categories?: string[];
          include_keywords?: string[];
          exclude_keywords?: string[];
          min_budget_usd?: number;
          is_active?: boolean;
          notify_telegram?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_project_actions: {
        Row: {
          id: string;
          user_id: string;
          project_id: string;
          status: ProjectActionStatus;
          generated_proposal: string | null;
          notes: string | null;
          matched_filter_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id: string;
          status?: ProjectActionStatus;
          generated_proposal?: string | null;
          notes?: string | null;
          matched_filter_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          project_id?: string;
          status?: ProjectActionStatus;
          generated_proposal?: string | null;
          notes?: string | null;
          matched_filter_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      auto_bidding_configs: {
        Row: {
          id: string;
          user_id: string;
          is_enabled: boolean;
          min_match_score: number;
          schedule_start_hour: number;
          schedule_end_hour: number;
          active_days: string[];
          review_mode: "require_approval" | "full_auto";
          ab_testing_enabled: boolean;
          template_a_id: string | null;
          template_b_id: string | null;
          daily_limit: number;
          smart_delay_minutes: number;
          smart_attachments: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          is_enabled?: boolean;
          min_match_score?: number;
          schedule_start_hour?: number;
          schedule_end_hour?: number;
          active_days?: string[];
          review_mode?: "require_approval" | "full_auto";
          ab_testing_enabled?: boolean;
          template_a_id?: string | null;
          template_b_id?: string | null;
          daily_limit?: number;
          smart_delay_minutes?: number;
          smart_attachments?: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          is_enabled?: boolean;
          min_match_score?: number;
          schedule_start_hour?: number;
          schedule_end_hour?: number;
          active_days?: string[];
          review_mode?: "require_approval" | "full_auto";
          ab_testing_enabled?: boolean;
          template_a_id?: string | null;
          template_b_id?: string | null;
          daily_limit?: number;
          smart_delay_minutes?: number;
          smart_attachments?: any;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      auto_bid_queue: {
        Row: {
          id: string;
          user_id: string;
          project_id: string | null;
          lead_id: string | null;
          match_score: number;
          status: "pending_review" | "approved" | "rejected" | "auto_sent";
          generated_proposal: string;
          template_used_id: string | null;
          template_variant: string | null;
          selected_attachment: any;
          platform_url: string;
          scheduled_at: string;
          processed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id?: string | null;
          lead_id?: string | null;
          match_score?: number;
          status?: "pending_review" | "approved" | "rejected" | "auto_sent";
          generated_proposal: string;
          template_used_id?: string | null;
          template_variant?: string | null;
          selected_attachment?: any;
          platform_url: string;
          scheduled_at?: string;
          processed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          project_id?: string | null;
          lead_id?: string | null;
          match_score?: number;
          status?: "pending_review" | "approved" | "rejected" | "auto_sent";
          generated_proposal?: string;
          template_used_id?: string | null;
          template_variant?: string | null;
          selected_attachment?: any;
          platform_url?: string;
          scheduled_at?: string;
          processed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      // Backward compatibility schemas
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          bio_context: string | null;
          telegram_chat_id: string | null;
          telegram_connect_token: string | null;
          subscription_tier: string;
          subscription_ends_at: string | null;
          smart_replies_used: number;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          bio_context?: string | null;
          telegram_chat_id?: string | null;
          telegram_connect_token?: string | null;
          subscription_tier?: string;
          subscription_ends_at?: string | null;
          smart_replies_used?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          bio_context?: string | null;
          telegram_chat_id?: string | null;
          telegram_connect_token?: string | null;
          subscription_tier?: string;
          subscription_ends_at?: string | null;
          smart_replies_used?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          slug: string;
          name_ar: string;
          reddit_subreddits: string[];
          boolean_query_ar: string;
          boolean_query_en: string;
          is_active: boolean;
        };
        Insert: {
          slug: string;
          name_ar: string;
          reddit_subreddits?: string[];
          boolean_query_ar?: string;
          boolean_query_en?: string;
          is_active?: boolean;
        };
        Update: {
          slug?: string;
          name_ar?: string;
          reddit_subreddits?: string[];
          boolean_query_ar?: string;
          boolean_query_en?: string;
          is_active?: boolean;
        };
        Relationships: [];
      };
      user_subscriptions_map: {
        Row: {
          id: string;
          user_id: string;
          category_slug: string;
          custom_include_keywords: string[];
          min_intent_score: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_slug: string;
          custom_include_keywords?: string[];
          min_intent_score?: number;
        };
        Update: {
          id?: string;
          user_id?: string;
          category_slug?: string;
          custom_include_keywords?: string[];
          min_intent_score?: number;
        };
        Relationships: [];
      };
      leads_pool: {
        Row: {
          id: string;
          platform: string;
          external_post_id: string;
          author_handle: string | null;
          post_text: string;
          post_url: string;
          category_slug: string | null;
          intent_score: number | null;
          is_buyer: boolean | null;
          ai_reason_short: string | null;
          status: string;
          published_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          platform: string;
          external_post_id: string;
          author_handle?: string | null;
          post_text: string;
          post_url: string;
          category_slug?: string | null;
          intent_score?: number | null;
          is_buyer?: boolean | null;
          ai_reason_short?: string | null;
          status?: string;
          published_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          platform?: string;
          external_post_id?: string;
          author_handle?: string | null;
          post_text?: string;
          post_url?: string;
          category_slug?: string | null;
          intent_score?: number | null;
          is_buyer?: boolean | null;
          ai_reason_short?: string | null;
          status?: string;
          published_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      user_lead_deliveries: {
        Row: {
          id: string;
          user_id: string;
          lead_id: string;
          delivered_at: string;
          smart_reply_generated: string | null;
          smart_reply_generated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          lead_id: string;
          delivered_at?: string;
          smart_reply_generated?: string | null;
          smart_reply_generated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          lead_id?: string;
          delivered_at?: string;
          smart_reply_generated?: string | null;
          smart_reply_generated_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
