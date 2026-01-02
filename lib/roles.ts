import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type Role = "admin" | "participant";

export async function getUserRole(email: string | null | undefined): Promise<Role> {
  if (!email) return "participant";

  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (data?.role === "admin") return "admin";
  return "participant";
}
