"use client";

import NepalVoucherForm from "@/components/nepal/VoucherForm";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { Button } from "@/components/ui/button";
import { VoucherSelectionProvider } from "@/context/VoucherSelectionContext";
import { useSession } from "next-auth/react";
import Link from "next/link";

export default function NepalDashboard() {
  const { data } = useSession();
  if (data?.user?.region !== "nepal") {
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
      <h1 className="text-2xl font-bold mb-2 text-center">Welcome, Nepal Admin 🇳🇵</h1>
      <p className="text-gray-600 mb-4 text-center">
      Track purchases and sales from Indian companies. Manage local vouchers
      here. <p>{`(Auto Pull By Webhook 2nd try)`}</p>
      </p>
      <NepalVoucherForm />
    </DashboardLayout>
  </VoucherSelectionProvider>
  );
}
