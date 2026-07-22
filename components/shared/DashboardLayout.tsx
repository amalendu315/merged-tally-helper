"use client";

import { LogOut } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();

  return (
    <div className="flex min-h-screen bg-[#f9fafb] text-gray-800">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Topbar */}
        <header className="h-16 bg-white border-b shadow-sm px-6 flex items-center justify-between">
          <div className="text-2xl font-bold tracking-tight text-blue-600">
            Tally Helper
          </div>
          <h2 className="text-lg font-semibold">
            Welcome, {session?.user.name}!
          </h2>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2 text-red-500 hover:text-red-700 text-sm"
          >
            <LogOut size={16} />
            Logout
          </button>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
