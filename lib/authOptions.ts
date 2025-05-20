import{ NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getConnection } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials) return null;

        const pool = await getConnection();
        const result = await pool
          .request()
          .input("username", credentials.username)
          .input("password", credentials.password)
          .query(
            "SELECT * FROM TallyUsers WHERE username = @username AND password = @password"
          );

        const user = result.recordset[0];
        if (user) {
          return {
            id: String(user.id), // must be string for NextAuth
            name: user.username,
            region: user.region,
          };
        }
        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.region = (user as any).region;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.region = token.region as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
  },
};
