"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useVoucherSelection } from "@/context/VoucherSelectionContext";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import VoucherList from "./VoucherList";
import UploadProgressModal from "../shared/UploadSummaryLayout";

export default function ReturnVoucherForm() {
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
        const res = await fetch("/api/sync-log?region=india&type=return");
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

  const isNepalVoucher = (v: any) => {
    const country = v.Country?.toLowerCase() || "";
    const main = v.CountryMain?.toLowerCase() || "";
    const state = v.State?.toLowerCase() || "";
    return (
      country === "nepal" ||
      v.CountryID === 4 
    );
  };

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

      const data = await response?.json();
      if (!response?.ok) {
        toast.error("No Data Found");
      } else {
        const testKeywords = ["test", "dummy", "demo", "xyz", "airline test"];

        const sortedVouchers = [...data.data]
          .filter(
            (voucher) =>
              voucher.Types === "Invoice Return" &&
              !testKeywords.some((keyword) =>
                voucher.AccountName?.toLowerCase().includes(keyword)
              )
          )
          .sort((a, b) => a.InvoiceNo - b.InvoiceNo);

        setVouchers(sortedVouchers);
        setSelectedInvoiceNos([]);

        const total = sortedVouchers.reduce(
          (sum: number, v: any) => sum + v.FinalRate * v.pax,
          0
        );
        setTotalSum(total);
        toast.success(`Loaded ${sortedVouchers.length} return vouchers`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch vouchers");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!vouchers.length) return toast.error("No vouchers to export.");

    const selected = selectedInvoiceNos.length
      ? vouchers.filter((v) => selectedInvoiceNos.includes(v.InvoiceNo))
      : vouchers;

    if (!selected.length) return toast.error("No selected vouchers to export.");

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
    XLSX.utils.book_append_sheet(wb, ws, "ReturnVouchers");
    XLSX.writeFile(wb, "Return_Vouchers.xlsx");

    toast.success("Exported to Excel");
  };

  const handlePushToCloud = async () => {
    if (!selectedInvoiceNos.length)
      return toast.error("Select vouchers to push");

    setPushing(true);
    setUploading(true);
    setModalOpen(true);

    try {
      const selected = vouchers.filter((v) =>
        selectedInvoiceNos.includes(v.InvoiceNo)
      );

      const duplicatePushes = selected.filter(
        (v) =>
          syncMeta?.start_voucher &&
          syncMeta?.end_voucher &&
          v.InvoiceNo >= syncMeta.start_voucher &&
          v.InvoiceNo <= syncMeta.end_voucher
      );

      if (duplicatePushes.length > 0) {
        toast.error(
          `Already pushed vouchers selected: ${duplicatePushes
            .map((v) => v.InvoiceNo)
            .join(", ")}`
        );
        setUploading(false);
        return;
      }

      const prepareData = (entries: any[]): any[] => {
        return entries.map((v) => {
          const ledgerPrefix = v.FinPrefix === "ASCN/25-26/" ? "SR/25-26/" : "";
          return {
            branchName: "AirIQ",
            vouchertype: "Credit Note",
            voucherno: `${ledgerPrefix}${v.InvoiceNo}`,
            voucherdate:
              v.SaleEntryDate?.split("T")[0].replace(/-/g, "/") || "",
            narration: `${v.Pnr ?? "Unknown PNR"} | PAX :- ${v.pax ?? 0}`,
            ledgerAllocation: [
              {
                lineno: 1,
                ledgerName: isNepalVoucher(v)
                  ? "Air IQ Nepal"
                  : v.AccountName ?? "Unknown Ledger",
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
          };
        });
      };

      const pushToCloud = async (
        payload: any[],
        attempt = 1
      ): Promise<boolean> => {
        try {
          const res = await fetch("/api/india/return-cloud", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: payload }),
          });
          return res.ok;
        } catch {
          if (attempt < 3) {
            await new Promise((r) => setTimeout(r, 2000 * attempt));
            return pushToCloud(payload, attempt + 1);
          }
          return false;
        }
      };

      const batchSize = 50;
      const currentDate = new Date().toISOString().split("T")[0];
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
        const payload = prepareData(batch);
        if (!payload.length) continue;
        const success = await pushToCloud(payload);
        if (success) {
          successful += payload.length;
        } else {
          failed += payload.length;
          retried += 2;
        }

        setUploadStats({
          total: selected.length,
          successful,
          failed,
          retried,
        });
      }

      if (failed === selected.length) {
        toast.error("All return vouchers failed to push");
        setUploading(false);
        return;
      }

      const body = {
        region: "india",
        voucher_type: "return",
        submission_date: currentDate,
        last_updated_date: selected.at(-1)?.InvoiceEntryDate?.split("T")[0],
        start_date: dateRange.start,
        end_date: dateRange.end,
        start_voucher: selected.at(0)?.InvoiceNo,
        end_voucher: selected.at(-1)?.InvoiceNo,
      };

      await fetch("/api/sync-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      toast.success("Return vouchers pushed successfully!");
      setSelectedInvoiceNos([]);
    } catch (err) {
      console.error(err);
      toast.error("Failed to push to cloud");
    } finally {
      setUploading(false);
      setPushing(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-6">
        {/* LEFT PANEL */}
        <Card className="border border-yellow-100 shadow-sm bg-gradient-to-br from-white to-yellow-50">
          <CardHeader>
            <CardTitle className="text-base font-medium text-yellow-700">
              🔁 Return Sync Summary
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
                label: "Last Updated Return Voucher",
                value: formatDate(syncMeta?.last_updated_date),
              },
              {
                label: "Voucher Range",
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
                <p className={`text-xs font-medium text-gray-500`}>{label}</p>
                <p
                  className={`text-base font-semibold ${
                    color ? color : "text-black"
                  }`}
                >
                  {value}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* RIGHT PANEL */}
        <Card className="p-2 border border-yellow-100 shadow-sm bg-gradient-to-br from-white to-yellow-50">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-yellow-800">
              Return Voucher Actions
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
                {loading ? "Fetching..." : "Fetch Return Entries"}
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
          <Card className="border border-yellow-100 shadow-sm bg-yellow-50">
            <CardHeader>
              <CardTitle className="text-base text-yellow-700">
                📦 Total Fetched
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold text-yellow-700">
              {vouchers.length} Vouchers
            </CardContent>
          </Card>

          <Card className="border border-blue-100 shadow-sm bg-blue-50">
            <CardHeader>
              <CardTitle className="text-base text-blue-700">
                ✅ Selected
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold text-blue-700">
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
