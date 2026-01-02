import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getUserRole } from "@/lib/roles";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn({ user }) {
      const email = user.email?.toLowerCase();
      if (!email) return false;
      const { data } = await supabaseAdmin
        .from("user_roles")
        .select("email")
        .eq("email", email)
        .maybeSingle();
      return Boolean(data);
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email as string | null;
        session.user.name = token.name as string | null;
        session.user.image = token.picture as string | null;
        const role = await getUserRole(session.user.email);
        (session.user as any).role = role;
      }
      return session;
    },
  },
};
