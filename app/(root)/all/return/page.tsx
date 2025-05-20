"use client";

import { VoucherSelectionProvider } from "@/context/VoucherSelectionContext";
import DashboardLayout from "@/components/shared/DashboardLayout";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import ReturnVoucherForm from "@/components/all/ReturnVoucherForm";
import { useSession } from "next-auth/react";
// import ReturnVoucherForm from "@/components/india/ReturnVoucherForm";

export default function AllInvoiceReturnPage() {
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
        <h1 className="text-2xl font-bold text-center">Return Invoices 🇮🇳</h1>
        <p className="text-gray-600 text-center">
          Manage and push credit notes (return invoices) to Tally cloud.
        </p>
        <div className="flex justify-end mb-4">
          <Link href="/all">
            <Button variant="outline">🔁 Go to Home</Button>
          </Link>
        </div>
        <ReturnVoucherForm />
      </DashboardLayout>
    </VoucherSelectionProvider>
  );
}
