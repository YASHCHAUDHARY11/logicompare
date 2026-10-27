"use client";

import React, { useRef, useState } from "react";
import { DownloadIcon, UploadIcon, CheckCircleIcon } from "@/components/icons";
import { BulkManifestRow, CalculatedQuote, Booking, Vendor, RateCard } from "@/types/freight";
import { MERCHANT_DETAILS } from "@/lib/constants";
import { formatINR, getLocalFallbackZone, generateCarrierDocket, getOfficialCarrierTrackingUrl } from "@/lib/freightUtils";
import { supabase } from "@/lib/supabaseClient";

interface BulkCsvTabProps {
  highVolumeMode: boolean;
  bulkManifestList: BulkManifestRow[];
  setBulkManifestList: React.Dispatch<React.SetStateAction<BulkManifestRow[]>>;
  onAutoSelectCheapest: () => void;
  onAutoSelectFastest: () => void;
  onSelectCarrierForRow: (rowId: string, vendorId: string) => void;
  bulkSettlementMethod: "direct_to_pay" | "direct_upi" | "corporate_credit";
  setBulkSettlementMethod: (val: "direct_to_pay" | "direct_upi" | "corporate_credit") => void;
  bulkConsolidatedUtr: string;
  setBulkConsolidatedUtr: (val: string) => void;
  onConfirmBatchBooking: () => Promise<void>;
  isBatchProcessing: boolean;
  handleBulkCsvUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  bulkCsvFileName: string;
  bulkUploadError: string;
}

export function BulkCsvTab({
  highVolumeMode,
  bulkManifestList,
  onAutoSelectCheapest,
  onAutoSelectFastest,
  onSelectCarrierForRow,
  bulkSettlementMethod,
  setBulkSettlementMethod,
  bulkConsolidatedUtr,
  setBulkConsolidatedUtr,
  onConfirmBatchBooking,
  isBatchProcessing,
  handleBulkCsvUpload,
  bulkCsvFileName,
  bulkUploadError
}: BulkCsvTabProps) {
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadBulkTemplate = () => {
    const csvHeader = "dest_pin,consignee_name,consignee_phone,delivery_address,total_boxes,box_weights,box_dimensions,declared_value\n";
    const sampleRows = [
      "400001,Prime Retailers Mumbai,9820044556,Shop 4 Crawford Market Mumbai,2,18; 12,45x35x30; 30x25x20,45000",
      "560001,Apex Tech Electronics,9845012345,7th Cross Electronic City Bengaluru,3,25; 10; 10,,65000",
      "700001,East Coast Traders,9830098765,Strand Road Burrabazar Kolkata,1,30,50x50x40,30000",
      "600001,South Goods Depot,9840011223,Parrys Corner George Town Chennai,2,15; 15,,25000",
      "500001,Deccan Pharma Hub,9849033445,Abids Circle Hyderabad,4,10; 10; 10; 10,35x30x25; 35x30x25; 30x25x20; 30x25x20,95000"
    ].join("\n");

    const blob = new Blob([csvHeader + sampleRows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "logicompare_bulk_consignments_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-4 rounded-2xl border border-indigo-800 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-bold text-sm">Auto-Locked Shipper Dispatch Origin:</span>
            <span className="font-mono bg-white/20 px-2 py-0.5 rounded text-xs font-bold">
              PIN {MERCHANT_DETAILS.defaultOriginPin} (DEL-NORTH-01)
            </span>
          </div>
          <p className="text-xs text-indigo-200">
            Warehouse: {MERCHANT_DETAILS.defaultWarehouseAddress}
          </p>
        </div>
        <button
          onClick={handleDownloadBulkTemplate}
          className="bg-white hover:bg-indigo-50 text-indigo-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center space-x-2 shadow-xs shrink-0"
        >
          <DownloadIcon className="w-4 h-4 text-indigo-600" />
          <span>📥 Download Bulk Consignment Template (.csv)</span>
        </button>
      </div>

      <div className="bg-white border-2 border-dashed border-indigo-200 rounded-2xl p-6 text-center space-y-4 shadow-xs">
        <input
          type="file"
          ref={bulkFileInputRef}
          accept=".csv,text/csv"
          onChange={handleBulkCsvUpload}
          className="hidden"
          id="bulk-csv-input"
        />
        <div className="max-w-md mx-auto space-y-2">
          <label
            htmlFor="bulk-csv-input"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs cursor-pointer inline-flex items-center space-x-2 shadow-md transition"
          >
            <UploadIcon className="w-4 h-4" />
            <span>{bulkCsvFileName ? `Replace File (${bulkCsvFileName})` : "Select Bulk Consignment CSV (40-50 Rows)"}</span>
          </label>
          <p className="text-[11px] text-slate-500">
            Supports multiple box weights separated by semicolon (e.g. <code className="bg-slate-100 px-1 py-0.5 rounded font-mono font-bold text-slate-800">25; 10; 10</code>) and optional dimensions (<code className="bg-slate-100 px-1 py-0.5 rounded font-mono font-bold text-slate-800">60x40x40; 30x25x20</code>).
          </p>
        </div>
        {bulkUploadError && (
          <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-xl font-bold max-w-lg mx-auto">
            {bulkUploadError}
          </p>
        )}
      </div>

      {bulkManifestList.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
                <span>Bulk Manifest Preview</span>
                <span className="bg-indigo-100 text-indigo-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  {bulkManifestList.length} Consignments Parsed
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Client-side batch quotes generated across all active carriers.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={onAutoSelectCheapest}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1.5 transition"
              >
                <span>⚡ Auto-Select Lowest Price for All</span>
              </button>
              <button
                onClick={onAutoSelectFastest}
                className="bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1.5 transition"
              >
                <span>🚀 Auto-Select Fastest SLA for All</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Dest PIN / City</th>
                  <th className="py-2.5 px-3">Consignee & Address</th>
                  <th className="py-2.5 px-3">Pkgs / Weights</th>
                  <th className="py-2.5 px-3">Billable Wt</th>
                  <th className="py-2.5 px-3">Assigned Carrier</th>
                  <th className="py-2.5 px-3">Direct Freight</th>
                  <th className="py-2.5 px-3">2% Fee</th>
                  <th className="py-2.5 px-3 text-right">Total (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {bulkManifestList.map((row, idx) => {
                  const quote = row.selectedQuote || row.quotes[0];
                  return (
                    <tr key={row.rowId} className="hover:bg-slate-50/80 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-500">{idx + 1}</td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono font-bold text-slate-900 block">{row.dest_pin}</span>
                        <span className="text-[10px] text-slate-500">{getLocalFallbackZone(row.dest_pin).city}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-slate-900 block">{row.consignee_name}</span>
                        <span className="text-[10px] text-slate-500 truncate max-w-[180px] block">{row.delivery_address}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-indigo-700 block">{row.total_boxes} Box(es)</span>
                        <span className="text-[10px] text-slate-500">
                          {row.boxes.map((b) => `${b.weight}kg`).join(", ")}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-bold font-mono text-slate-900 block">{row.billableWeight} kg</span>
                        {row.hasOmittedDimensions && (
                          <span
                            className="text-[9px] bg-amber-50 text-amber-800 border border-amber-200 px-1 py-0.2 rounded font-semibold block mt-0.5"
                            title="Volumetric scanning disputes at carrier hub may incur debit notes if dimensions are omitted."
                          >
                            ⚠️ Dead Wt Used
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <select
                          value={quote?.vendor?.id || ""}
                          onChange={(e) => onSelectCarrierForRow(row.rowId, e.target.value)}
                          className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none"
                        >
                          {row.quotes.map((q) => (
                            <option key={q.vendor.id} value={q.vendor.id}>
                              {q.vendor.name} ({q.rateCard.sla_days}d - {formatINR(q.breakdown.total)})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        {formatINR(quote?.breakdown?.freightSubtotal || 0)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-indigo-700">
                        ₹{quote?.breakdown?.platformConvenienceFee || 25}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-right text-emerald-800">
                        {formatINR(quote?.breakdown?.total || 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  Consolidated Settlement Method for All {bulkManifestList.length} Shipments:
                </span>
                <p className="text-[11px] text-slate-500">Freight is settled 100% directly with individual carriers with 0% markups.</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <label className={`px-3 py-1.5 rounded-lg border cursor-pointer font-bold ${bulkSettlementMethod === "direct_to_pay" ? "bg-emerald-100 border-emerald-400 text-emerald-900" : "bg-white"}`}>
                  <input
                    type="radio"
                    checked={bulkSettlementMethod === "direct_to_pay"}
                    onChange={() => setBulkSettlementMethod("direct_to_pay")}
                    className="mr-1.5 text-emerald-600"
                  />
                  💵 To-Pay at Delivery (POD)
                </label>
                <label className={`px-3 py-1.5 rounded-lg border cursor-pointer font-bold ${bulkSettlementMethod === "direct_upi" ? "bg-emerald-100 border-emerald-400 text-emerald-900" : "bg-white"}`}>
                  <input
                    type="radio"
                    checked={bulkSettlementMethod === "direct_upi"}
                    onChange={() => setBulkSettlementMethod("direct_upi")}
                    className="mr-1.5 text-emerald-600"
                  />
                  📲 Direct Carrier UPI
                </label>
                <label className={`px-3 py-1.5 rounded-lg border cursor-pointer font-bold ${bulkSettlementMethod === "corporate_credit" ? "bg-emerald-100 border-emerald-400 text-emerald-900" : "bg-white"}`}>
                  <input
                    type="radio"
                    checked={bulkSettlementMethod === "corporate_credit"}
                    onChange={() => setBulkSettlementMethod("corporate_credit")}
                    className="mr-1.5 text-emerald-600"
                  />
                  🏢 B2B Monthly Credit Terms
                </label>
              </div>
            </div>

            {bulkSettlementMethod === "direct_upi" && (
              <div className="flex items-center space-x-3 text-xs">
                <label className="font-bold text-slate-700">Consolidated Payment UTR / Reference:</label>
                <input
                  type="text"
                  value={bulkConsolidatedUtr}
                  onChange={(e) => setBulkConsolidatedUtr(e.target.value)}
                  placeholder="e.g. 409827104928"
                  className="bg-white border border-slate-300 rounded px-3 py-1.5 font-mono text-slate-900 flex-1 max-w-sm"
                />
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="text-xs space-y-0.5">
                <span className="text-slate-500">Consolidated Outlay: </span>
                <strong className="text-base text-emerald-800 font-mono">
                  {formatINR(bulkManifestList.reduce((acc, r) => acc + (r.selectedQuote?.breakdown?.total || 0), 0))}
                </strong>
                <span className="text-[11px] text-slate-500 block">
                  Includes Platform 2% convenience fee ({formatINR(bulkManifestList.reduce((acc, r) => acc + (r.selectedQuote?.breakdown?.platformConvenienceFee || 25), 0))})
                </span>
              </div>
              <button
                disabled={isBatchProcessing}
                onClick={onConfirmBatchBooking}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-6 py-3 rounded-xl text-xs transition shadow-md flex items-center space-x-2"
              >
                <CheckCircleIcon className="w-4 h-4" />
                <span>{isBatchProcessing ? "Assigning Dockets..." : `Confirm & Book All ${bulkManifestList.length} Consignments`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
