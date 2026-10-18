import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { Database } from "./types";

function getEnvVal(key: string): string {
  if (process.env[key]) return process.env[key]!;
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      const match = content.match(new RegExp(`^${key}=(.*)$`, "m"));
      if (match) return match[1].trim();
    }
  } catch {}
  return "";
}

const supabaseUrl = getEnvVal("NEXT_PUBLIC_SUPABASE_URL") || getEnvVal("SUPABASE_URL");
const serviceRoleKey = getEnvVal("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  console.warn("[!] Warning: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not defined in environment.");
}

export const supabaseAdmin = createClient<Database>(
  supabaseUrl || "https://placeholder.supabase.co",
  serviceRoleKey || "placeholder-key",
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
