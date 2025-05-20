"use client";

import { LogOut } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
// import Link from "next/link";
// import { usePathname } from "next/navigation";
// import clsx from "clsx";

// const navItems = [
//   { name: "Dashboard", icon: LayoutDashboard, href: "#" },
//   { name: "Vouchers", icon: FileText, href: "#" },
//   { name: "Push to Cloud", icon: CloudUpload, href: "#" },
// ];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();
//   const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-[#f9fafb] text-gray-800">
      {/* Sidebar */}
      {/* <aside className="w-64 bg-white border-r shadow-sm p-6 flex flex-col gap-10">
        <div className="text-2xl font-bold tracking-tight text-blue-600">
          Tally Helper
        </div>

        <nav className="flex flex-col gap-4">
          {navItems.map(({ name, icon: Icon, href }) => (
            <Link
              key={name}
              href={href}
              className={clsx(
                "flex items-center gap-3 px-4 py-2 rounded-lg transition-all",
                pathname === href
                  ? "bg-blue-100 text-blue-700 font-semibold"
                  : "hover:bg-gray-100 hover:text-blue-600"
              )}
            >
              <Icon size={18} />
              <span>{name}</span>
            </Link>
          ))}
        </nav>

        <div className="mt-auto flex items-center justify-between text-sm text-gray-500">
          <span className="font-medium">Region:</span>
          <span className="uppercase font-semibold">
            {session?.user.region}
          </span>
        </div>
      </aside> */}

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
