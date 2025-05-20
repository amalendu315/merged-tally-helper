"use client";

import AllVoucherForm from "@/components/all/VoucherForm";
import NepalVoucherForm from "@/components/nepal/VoucherForm";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { Button } from "@/components/ui/button";
import { VoucherSelectionProvider } from "@/context/VoucherSelectionContext";
import { useSession } from "next-auth/react";
import Link from "next/link";

export default function AllDashboard() {
    const { data } = useSession();
    if (data?.user?.region !== "all") {
      return (
        <div className="flex flex-col items-center justify-center h-screen">
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">
            You do not have access to this page.
          </p>
          <Link href="/">
            <Button>Go to Home</Button>
          </Link>
          <p className="text-gray-600 mt-4">
            If you believe this is a mistake, please contact support.
          </p>
        </div>
      );
    }
  return (
    <VoucherSelectionProvider>
      <DashboardLayout>
        <h1 className="text-2xl font-bold mb-2 text-center">
          Welcome, All Admin IN
        </h1>
        <p className="text-gray-600 mb-4 text-center">
          Track purchases and sales from Indian companies. Manage local vouchers
          here.
        </p>
        <div className="flex justify-end mb-4">
          <Link href="/all/return">
            <Button variant="outline">🔁 Go to Return Invoices</Button>
          </Link>
        </div>
        <AllVoucherForm />
      </DashboardLayout>
    </VoucherSelectionProvider>
  );
}
