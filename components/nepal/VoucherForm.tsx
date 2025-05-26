"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useVoucherSelection } from "@/context/VoucherSelectionContext";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { format, set } from "date-fns";
import VoucherList from "./VoucherList";
import UploadProgressModal from "../shared/UploadSummaryLayout";

export default function NepalVoucherForm() {
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

  // Track last voucher number for numbering Sales vouchers
  const [lastUsedVoucherNumber, setLastUsedVoucherNumber] = useState(0);
  const lastVoucherRef = useRef(0); // <--- NEW

  // Fetch last sync log info on mount to get lastUsedVoucherNumber
  useEffect(() => {
    const loadSyncMeta = async () => {
      try {
        const res = await fetch("/api/sync-log?region=nepal&type=sales");
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

  // Update voucher number from sync metadata on change
  useEffect(() => {
    if (syncMeta?.last_updated_voucher_number) {
      setLastUsedVoucherNumber(syncMeta.last_updated_voucher_number);
      lastVoucherRef.current = syncMeta.last_updated_voucher_number;
    }
  }, [syncMeta]);

  // Utility for consistent date formatting
  const formatDate = (dateStr?: string) =>
    dateStr ? format(new Date(dateStr), "yyyy-MM-dd") : "N/A";

  // Fetch vouchers from API filtered by date and Nepal criteria
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
        .filter((v) => {
          const country = v.Country?.toLowerCase() || "";
          const main = v.CountryMain?.toLowerCase() || "";
          const state = v.State?.toLowerCase() || "";
          const accountName = v.AccountName?.toLowerCase() || "";

          return (
            v.Types === "Invoice" &&
            !testKeywords.some((keyword) => accountName.includes(keyword)) &&
            (country === "nepal" ||
              main === "nepal" ||
              v.CountryID === 4 ||
              state.includes("province"))
          );
        })
        .sort((a, b) => a.InvoiceNo - b.InvoiceNo);

      setVouchers(sorted);
      setSelectedInvoiceNos([]);

      const total = sorted.reduce(
        (sum: number, v: any) => sum + v.FinalRate * v.pax,
        0
      );
      setTotalSum(total);

      toast.success(`Fetched ${sorted.length} Nepal vouchers`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  // Export selected vouchers to Excel, or all if none selected
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
    XLSX.utils.book_append_sheet(wb, ws, "NepalVouchers");
    XLSX.writeFile(wb, "Nepal_Vouchers.xlsx");

    toast.success("Exported to Excel");
  };

  // Submit vouchers to backend endpoint, type is 'sale' or 'purchase'
  // const submitVouchers = async (
  //   dataForCloud: any[],
  //   type: "sale" | "purchase"
  // ) => {
  //   try {
  //     const response = await fetch(`/api/${type}`, {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //       },
  //       body: JSON.stringify({ data: dataForCloud }),
  //     });

  //     if (!response.ok) {
  //       const errorText = await response.text();
  //       console.error(
  //         `${type.toUpperCase()} server error:`,
  //         response.status,
  //         errorText
  //       );
  //       throw new Error(
  //         `${type.toUpperCase()} server responded with status ${
  //           response.status
  //         }`
  //       );
  //     }
  //     toast.success(`${type.toUpperCase()} vouchers submitted successfully!`);
  //   } catch (error) {
  //     console.error(`Error submitting ${type} data:`, error);
  //     toast.error(`Error Submitting ${type.toUpperCase()} Data To Cloud!`);
  //     throw error; // throw so calling function knows failure
  //   }
  // };

  const submitWithRetry = async (
    payload: any[],
    type: "sale" | "purchase",
    maxRetries = 2
  ): Promise<{ success: boolean; retries: number }> => {
    let attempt = 0;
    while (attempt <= maxRetries) {
      try {
        const response = await fetch(`/api/nepal/${type}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: payload }),
        });
        if (!response.ok) {
          throw new Error(`Status ${response.status}`);
        }
        return { success: true, retries: attempt };
      } catch (err) {
        attempt++;
        if (attempt > maxRetries) {
          return { success: false, retries: attempt - 1 };
        }
        // Wait before retrying (exponential backoff)
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
    return { success: false, retries: maxRetries };
  };

  // Prepare Purchase vouchers data batch
  const preparePurchaseData = (entries: any[], exchangeRate: number) => {
    return entries.map((v) => {
      const convertedPurchaseAmountNPR = (
        v.FinalRate *
        v.pax *
        exchangeRate
      ).toFixed(2);

      return {
        branchName: "AirIQ Nepal",
        vouchertype: "Purchase",
        voucherno: `AQNP/${v.InvoiceNo}`,
        voucherdate: v.SaleEntryDate?.split("T")[0].replace(/-/g, "/") || "",
        narration: `${v.Prefix}-${v.SaleID}, PNR :- ${v.Pnr}, PAX :- ${v.pax}`,
        ledgerAllocation: [
          {
            lineno: 1,
            ledgerName: "Air IQ",
            ledgerAddress: "Sevoke Road, Siliguri, West Bengal - 734001",
            amount: convertedPurchaseAmountNPR,
            drCr: "cr",
            description: [],
          },
          {
            lineno: 2,
            ledgerName: "Domestic Base Fare Purchase",
            amount: convertedPurchaseAmountNPR,
            drCr: "dr",
            description: [],
          },
        ],
      };
    });
  };

  // Prepare Sales vouchers data batch & update voucher numbering state
  const prepareSalesData = (entries: any[], exchangeRate: number) => {
    const salesData = entries.map((v) => {
      lastVoucherRef.current += 1;
      const formattedVoucherNumber = `AQNS/${lastVoucherRef.current
        .toString()
        .padStart(lastVoucherRef.current >= 1000 ? 4 : 3, "0")}`;
      const convertedAmountNPR = (v.FinalRate * v.pax * exchangeRate).toFixed(
        2
      );

      return {
        branchName: "AirIQ Nepal",
        vouchertype: "Sales",
        voucherno: formattedVoucherNumber,
        voucherdate: v.SaleEntryDate?.split("T")[0].replace(/-/g, "/") || "",
        narration: `${v.Prefix}-${v.SaleID}, PNR :- ${v.Pnr}, PAX :- ${v.pax}, AIRLINE_CODE :- ${v.AirlineCode}, SECTOR :- ${v.FromSector} ${v.ToSectors}`,
        ledgerAllocation: [
          {
            lineno: 1,
            ledgerName: v.AccountName,
            ledgerAddress: `${v.Add1 ?? ""}, ${v.Add2 ?? ""}, ${
              v.CityName ?? ""
            } - ${v.Pin ?? ""}`,
            amount: convertedAmountNPR,
            drCr: "dr",
            description: [],
          },
          {
            lineno: 2,
            ledgerName: "Domestic Base Fare",
            amount: convertedAmountNPR,
            drCr: "cr",
            description: [
              v.AirlineCode,
              "Sector",
              `${v.FromSector} ${v.ToSectors}`,
            ],
          },
        ],
      };
    });

    return salesData;
  };
  

  // Fetch exchange rate once per push
  const fetchExchangeRate = async () => {
    try {
      const response = await fetch(
        "https://api.exchangerate-api.com/v4/latest/INR"
      );
      const data = await response.json();
      return data.rates["NPR"] || 1.6; // fallback
    } catch (error) {
      console.error("Error fetching exchange rate:", error);
      return 1.6;
    }
  };

  // Main push function that handles batching and sync log update
  const handlePushToCloud = async () => {
    if (!selectedInvoiceNos.length) {
      toast.error("Select vouchers to push");
      return;
    }
    setModalOpen(true);
    setUploading(true);
    setPushing(true);

    try {
      const exchangeRate = await fetchExchangeRate();

      // Filter selected vouchers
      const selected = vouchers.filter((v) =>
        selectedInvoiceNos.includes(v.InvoiceNo)
      );

      const pushedInvoiceRange = {
        start: syncMeta?.start_voucher,
        end: syncMeta?.end_voucher,
      };

      const duplicatePushes = selectedInvoiceNos.filter(
        (no) => no >= pushedInvoiceRange.start && no <= pushedInvoiceRange.end
      );

      if (duplicatePushes.length > 0) {
        toast.error(
          `Already pushed vouchers selected: ${duplicatePushes.join(", ")}`
        );
        setUploading(false);
        return;
      }

      let successfulUploads = 0;
      let failedUploads = 0;
      let totalRetries = 0;

      const batchSize = 50;

      setUploadStats({
        total: selected.length * 2, // because purchase + sales per voucher
        successful: 0,
        failed: 0,
        retried: 0,
      });

      for (let i = 0; i < selected.length; i += batchSize) {
        const batch = selected.slice(i, i + batchSize);

        const purchasePayload = preparePurchaseData(batch, exchangeRate);
        const salesPayload = prepareSalesData(batch, exchangeRate);

        console.log("Purchase Payload", purchasePayload);
        console.log("Sales Payload", salesPayload);

        //submit purchase with retry
        const purchaseResult = await submitWithRetry(
          purchasePayload,
          "purchase"
        );
        // // update stats immediately
        if (purchaseResult.success) successfulUploads += purchasePayload.length;
        else failedUploads += purchasePayload.length;
        totalRetries += purchaseResult.retries;

        setUploadStats({
          total: selected.length * 2,
          successful: successfulUploads,
          failed: failedUploads,
          retried: totalRetries,
        });

        // // submit sales with retry
        const salesResult = await submitWithRetry(salesPayload, "sale");
        if (salesResult.success) successfulUploads += salesPayload.length;
        else failedUploads += salesPayload.length;
        totalRetries += salesResult.retries;

        setUploadStats({
          total: selected.length * 2,
          successful: successfulUploads,
          failed: failedUploads,
          retried: totalRetries,
        });
      }

      //stop updating stats if all are unsuccessful
      if (failedUploads === selected.length * 2) {
        toast.error("All vouchers failed to push");
        setUploading(false);
        return;
      }
      // // Update sync log metadata on backend
      const currentDate = new Date().toISOString().split("T")[0];
      const body = {
        region: "nepal",
        voucher_type: "sales",
        submission_date: currentDate,
        last_updated_date: selected.at(-1)?.SaleEntryDate?.split("T")[0] || "",
        start_date: dateRange.start,
        end_date: dateRange.end,
        start_voucher: selected.at(0)?.InvoiceNo || 0,
        end_voucher: selected.at(-1)?.InvoiceNo || 0,
        last_voucher_number: lastVoucherRef.current, // <--- use latest from ref
      };
      

      await fetch("/api/sync-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      setUploading(false);

      toast.success("All vouchers submitted successfully!");

      // Clear selection after successful push (optional UX improvement)
      setSelectedInvoiceNos([]);
    } catch (error) {
      console.error(error);
      toast.error("Failed to push to cloud");
    } finally {
      setPushing(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-6">
        {/* LEFT PANEL */}
        <Card className="border border-purple-100 shadow-sm bg-gradient-to-br from-white to-purple-50">
          <CardHeader>
            <CardTitle className="text-base font-medium text-purple-700">
              🔄 Nepal Sync Summary
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
                label: "Last Updated Sale Entry Date",
                value: formatDate(syncMeta?.last_updated_date),
              },
              {
                label: "Last Updated Sale Voucher Number",
                value: syncMeta?.last_updated_voucher_number,
                color: "text-blue-600",
              },
              {
                label: "Invoice Number Range",
                value: `#${syncMeta?.start_voucher} → #${syncMeta?.end_voucher}`,
              },
              {
                label: "Invoice Entry Date Range",
                value: `${formatDate(syncMeta?.start_date)} → ${formatDate(
                  syncMeta?.end_date
                )}`,
              },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <p className={`text-xs font-medium text-gray-500`}>{label}</p>
                <p
                  className={`text-base font-semibold  ${
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
        <Card className="p-2 border border-purple-100 shadow-sm bg-gradient-to-br from-white to-purple-50">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-purple-800">
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
                disabled={loading || !dateRange.start || !dateRange.end}
              >
                {loading ? "Fetching..." : "Fetch Entries"}
              </Button>
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              <Button
                variant="outline"
                onClick={handleExport}
                disabled={!vouchers.length}
              >
                Export to Excel
              </Button>
              <Button
                onClick={handlePushToCloud}
                disabled={pushing || !selectedInvoiceNos.length}
              >
                {pushing ? "Submitting..." : "Submit to Cloud"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* SUMMARY */}
        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border border-purple-100 shadow-sm bg-purple-50">
            <CardHeader>
              <CardTitle className="text-base text-purple-700">
                📦 Total Fetched
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold text-purple-700">
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
