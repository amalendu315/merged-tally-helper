"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useVoucherSelection } from "@/context/VoucherSelectionContext";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import VoucherList from "./VoucherList";
import { isNepalVoucher } from "@/lib/utils";
import UploadProgressModal from "../shared/UploadSummaryLayout";

export default function IndiaVoucherForm() {
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [syncMeta, setSyncMeta] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStats, setUploadStats] = useState({
    total: 0,
    successful: 0,
    failed: 0,
    retried: 0,
  });

  const { totalSum, setTotalSum, setSelectedInvoiceNos, selectedInvoiceNos } =
    useVoucherSelection();

  useEffect(() => {
    const loadSyncMeta = async () => {
      try {
        const res = await fetch("/api/sync-log?region=india&type=sales");
        if (res.status === 200) {
          const result = await res.json();
          setSyncMeta(result.data);
        }
      } catch (err) {
        console.error("Failed to fetch sync log", err);
      }
    };
    loadSyncMeta();
  }, []);

  const formatDate = (dateStr?: string) =>
    dateStr ? format(new Date(dateStr), "yyyy-MM-dd") : "N/A";

  const handleFetch = async () => {
    if (!dateRange.start || !dateRange.end) {
      toast.error("Please select both start and end date.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/sales?startDate=${dateRange.start}&endDate=${dateRange.end}`
      );
      const data = await response.json();
      if (!response.ok) {
        toast.error("Failed to fetch vouchers");
        return;
      }

      const testKeywords = ["test", "dummy", "demo", "xyz", "airline test"];
      const sorted = [...data.data]
        .filter(
          (v) =>
            v.Types === "Invoice" &&
            !testKeywords.some((k) => v.AccountName?.toLowerCase().includes(k))
        )
        .sort((a, b) => a.InvoiceNo - b.InvoiceNo);

      setVouchers(sorted);
      setSelectedInvoiceNos([]);
      const total = sorted.reduce(
        (sum: number, v: any) => sum + v.FinalRate * v.pax,
        0
      );
      setTotalSum(total);
      toast.success(`Fetched ${sorted.length} vouchers`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const selected = selectedInvoiceNos.length
      ? vouchers.filter((v) => selectedInvoiceNos.includes(v.InvoiceNo))
      : vouchers;

    if (!selected.length) return toast.error("No vouchers to export");

    const formatted = selected.map((v) => ({
      InvoiceNo: v.InvoiceNo,
      SaleEntryDate: v.SaleEntryDate,
      PNR: v.Pnr,
      Pax: v.pax,
      Account: v.AccountName,
      FinalRate: v.FinalRate,
      Total: v.FinalRate * v.pax,
    }));

    const ws = XLSX.utils.json_to_sheet(formatted);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "IndiaVouchers");
    XLSX.writeFile(wb, "India_Vouchers.xlsx");

    toast.success("Exported to Excel");
  };

  const prepareSalesPayload = (entries: any[]) => {
    return entries.map((v) => ({
      branchName: "AirIQ",
      vouchertype: "Sales",
      voucherno: `${v.FinPrefix}${v.InvoiceNo}`,
      voucherdate: v.SaleEntryDate?.split("T")[0].replace(/-/g, "/") || "",
      narration: `${v.Pnr} | PAX :- ${v.pax}`,
      ledgerAllocation: [
        {
          lineno: 1,
          ledgerName: isNepalVoucher(v) ? "Air IQ Nepal" : v.AccountName,
          ledgerAddress: `${v.Add1 ?? ""}, ${v.Add2 ?? ""}, ${
            v.CityName ?? ""
          } - ${v.Pin ?? ""}`,
          amount: (v.FinalRate * v.pax).toFixed(2),
          drCr: "dr",
        },
        {
          lineno: 2,
          ledgerName: "Domestic Base Fare",
          amount: (v.FinalRate * v.pax).toFixed(2),
          drCr: "cr",
        },
      ],
    }));
  };

  const submitWithRetry = async (
    payload: any[],
    attempt = 1
  ): Promise<{
    success: boolean;
    retries: number;
  }> => {
    try {
      const res = await fetch("/api/india/cloud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: payload }),
      });
      return { success: res.ok, retries: attempt - 1 };
    } catch (err) {
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
        return submitWithRetry(payload, attempt + 1);
      }
      return { success: false, retries: attempt - 1 };
    }
  };

  const handlePushToCloud = async () => {
    if (!selectedInvoiceNos.length) {
      toast.error("Select vouchers to push");
      return;
    }

    setModalOpen(true);
    setUploading(true);
    setPushing(true);

    try {
      const selected = vouchers.filter((v) =>
        selectedInvoiceNos.includes(v.InvoiceNo)
      );

      const pushedRange = {
        start: syncMeta?.start_voucher ?? 0,
        end: syncMeta?.end_voucher ?? 0,
      };

      const duplicates = selected.filter(
        (v) =>
          v.InvoiceNo >= pushedRange.start && v.InvoiceNo <= pushedRange.end
      );
      if (duplicates.length > 0) {
        toast.error(
          `Duplicate vouchers selected: ${duplicates
            .map((v) => v.InvoiceNo)
            .join(", ")}`
        );
        setUploading(false);
        return;
      }

      const batchSize = 50;
      let successful = 0;
      let failed = 0;
      let retried = 0;

      setUploadStats({
        total: selected.length,
        successful,
        failed,
        retried,
      });

      for (let i = 0; i < selected.length; i += batchSize) {
        const batch = selected.slice(i, i + batchSize);
        const payload = prepareSalesPayload(batch);
        
        const result = await submitWithRetry(payload);

        if (result.success) successful += payload.length;
        else failed += payload.length;
        retried += result.retries;

        setUploadStats({
          total: selected.length,
          successful,
          failed,
          retried,
        });
      }

      if (failed === selected.length) {
        toast.error("All vouchers failed to push");
        setUploading(false);
        return;
      }

      const now = new Date().toISOString().split("T")[0];
      await fetch("/api/sync-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region: "india",
          voucher_type: "sales",
          submission_date: now,
          last_updated_date:
            selected.at(-1)?.InvoiceEntryDate?.split("T")[0] || "",
          start_date: dateRange.start,
          end_date: dateRange.end,
          start_voucher: selected.at(0)?.InvoiceNo || 0,
          end_voucher: selected.at(-1)?.InvoiceNo || 0,
        }),
      });

      toast.success("Vouchers pushed successfully!");
      setSelectedInvoiceNos([]);
    } catch (err) {
      console.error(err);
      toast.error("Failed to push to cloud");
    } finally {
      setPushing(false);
      setUploading(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-6">
        {/* LEFT PANEL */}
        <Card className="border border-blue-100 shadow-sm bg-gradient-to-br from-white to-blue-50">
          <CardHeader>
            <CardTitle className="text-base font-medium text-blue-600">
              🔄 India Sync Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0 text-sm text-gray-700">
            {[
              {
                label: "Submission Date",
                value: formatDate(syncMeta?.submission_date),
                color: "text-green-600",
              },
              {
                label: "Last Updated Voucher Date",
                value: formatDate(syncMeta?.last_updated_date),
              },
              {
                label: "Voucher Number Range",
                value: `#${syncMeta?.start_voucher} → #${syncMeta?.end_voucher}`,
              },
              {
                label: "Date Range",
                value: `${formatDate(syncMeta?.start_date)} → ${formatDate(
                  syncMeta?.end_date
                )}`,
              },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <p className="text-xs font-medium text-gray-500">{label}</p>
                <p
                  className={`text-base font-semibold ${color ?? "text-black"}`}
                >
                  {value}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* RIGHT PANEL */}
        <Card className="p-2 border border-blue-100 shadow-sm bg-gradient-to-br from-white to-blue-50">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-700">
              Voucher Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) =>
                  setDateRange({ ...dateRange, start: e.target.value })
                }
              />
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) =>
                  setDateRange({ ...dateRange, end: e.target.value })
                }
              />
              <Button
                className="w-full"
                onClick={handleFetch}
                disabled={loading}
              >
                {loading ? "Fetching..." : "Fetch Sales Entries"}
              </Button>
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="outline" onClick={handleExport}>
                Export to Excel
              </Button>
              <Button onClick={handlePushToCloud} disabled={pushing}>
                {pushing ? "Submitting..." : "Submit to Cloud"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* SUMMARY CARDS */}
        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border border-blue-100 shadow-sm bg-blue-50">
            <CardHeader>
              <CardTitle className="text-base text-blue-800">
                📦 Total Fetched
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold text-blue-700">
              {vouchers.length} Vouchers
            </CardContent>
          </Card>
          <Card className="border border-yellow-100 shadow-sm bg-yellow-50">
            <CardHeader>
              <CardTitle className="text-base text-yellow-800">
                ✅ Selected
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold text-yellow-700">
              {selectedInvoiceNos.length} Selected
            </CardContent>
          </Card>
          <Card className="border border-green-100 shadow-sm bg-green-50">
            <CardHeader>
              <CardTitle className="text-base text-green-800">
                💰 Total Value
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold text-green-700">
              ₹ {totalSum.toLocaleString("en-IN")}
            </CardContent>
          </Card>
        </div>

        {/* TABLE */}
        {vouchers.length > 0 && (
          <div className="md:col-span-2 mt-6">
            <VoucherList vouchers={vouchers} />
          </div>
        )}
      </div>

      <UploadProgressModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        stats={uploadStats}
        uploading={uploading}
      />
    </>
  );
}
