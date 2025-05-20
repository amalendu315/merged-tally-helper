"use client";
import Link from "next/link";
import { VoucherSelectionProvider } from "@/context/VoucherSelectionContext";
import DashboardLayout from "@/components/shared/DashboardLayout";
import VoucherForm from "@/components/india/VoucherForm";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";

export default function IndiaDashboard() {
  const { data } = useSession();
  if (data?.user?.region !== "india") {
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
        <h1 className="text-2xl font-bold text-center">Welcome, India Admin 🇮🇳</h1>
        <p className="text-gray-600 text-center">
          Manage all your vouchers, push to cloud, and sync with Tally from
          here.
        </p>
        <div className="flex justify-end mb-4">
          <Link href="/india/return">
            <Button variant="outline">🔁 Go to Return Invoices</Button>
          </Link>
        </div>
        <VoucherForm />
      </DashboardLayout>
    </VoucherSelectionProvider>
  );
}
  