import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      region?: string;
    };
  }

  interface User {
    id: string;
    region?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    region?: string;
  }
}
