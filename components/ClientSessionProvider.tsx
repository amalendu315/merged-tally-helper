"use client";

import { SessionProvider } from "next-auth/react";
import { Session } from "next-auth";

export default function ClientSessionProvider({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  return (
    <SessionProvider session={session} basePath="/tally/api/auth">
      {children}
    </SessionProvider>
  );
}
