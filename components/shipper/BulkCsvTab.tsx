"use client";

import React, { useRef } from "react";
import { DownloadIcon, UploadIcon, CheckCircleIcon } from "@/components/icons";
import { BulkManifestRow } from "@/types/freight";
import { MERCHANT_DETAILS } from "@/lib/constants";
import { formatINR, getLocalFallbackZone } from "@/lib/freightUtils";

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
      {/* Origin Dispatch Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl border border-indigo-900/60 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2.5">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-black text-sm tracking-wide text-white uppercase">Locked Shipper Dispatch Origin:</span>
            <span className="font-mono bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-2.5 py-0.5 rounded text-xs font-bold">
              PIN {MERCHANT_DETAILS.defaultOriginPin} (DEL-NORTH-01)
            </span>
          </div>
          <p className="text-xs text-indigo-200/90 font-medium">
            Warehouse Address: {MERCHANT_DETAILS.defaultWarehouseAddress}
          </p>
        </div>
        <button
          onClick={handleDownloadBulkTemplate}
          className="bg-white hover:bg-slate-100 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs flex items-center space-x-2 shadow-md shrink-0 transition"
        >
          <DownloadIcon className="w-4 h-4 text-indigo-600" />
          <span>Download Sample CSV Template</span>
        </button>
      </div>

      {/* CSV Dropzone */}
      <div className="bg-white border-2 border-dashed border-indigo-300 rounded-2xl p-8 text-center space-y-4 shadow-sm hover:border-indigo-500 transition">
        <input
          type="file"
          ref={bulkFileInputRef}
          accept=".csv,text/csv"
          onChange={handleBulkCsvUpload}
          className="hidden"
          id="bulk-csv-input"
        />
        <div className="max-w-lg mx-auto space-y-2.5">
          <label
            htmlFor="bulk-csv-input"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-6 py-3 rounded-xl text-xs cursor-pointer inline-flex items-center space-x-2 shadow-md transition hover:scale-105"
          >
            <UploadIcon className="w-4 h-4" />
            <span>{bulkCsvFileName ? `Replace (${bulkCsvFileName})` : "Select Bulk Consignment CSV (40-50 Locations)"}</span>
          </label>
          <p className="text-xs text-slate-600 font-medium">
            Supports multiple boxes using semicolon weights (e.g. <code className="bg-indigo-50 text-indigo-900 border border-indigo-200 px-1.5 py-0.5 rounded font-mono font-bold">25; 10; 10</code>) and dimensions (<code className="bg-indigo-50 text-indigo-900 border border-indigo-200 px-1.5 py-0.5 rounded font-mono font-bold">60x40x40; 30x25x20</code>).
          </p>
        </div>

        {bulkUploadError && (
          <div className="text-xs text-rose-800 bg-rose-50 border border-rose-300 p-3 rounded-xl font-bold max-w-lg mx-auto">
            {bulkUploadError}
          </div>
        )}
      </div>

      {/* Manifest Table Preview */}
      {bulkManifestList.length > 0 && (
        <div className="bg-white border border-slate-300 rounded-2xl shadow-md overflow-hidden space-y-5 p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-lg font-black text-slate-900 flex items-center space-x-2.5">
                <span>Bulk Consignment Manifest</span>
                <span className="bg-indigo-600 text-white text-xs px-3 py-0.5 rounded-full font-bold">
                  {bulkManifestList.length} Destinations
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">Multi-carrier quotes calculated client-side with 0ms server latency.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={onAutoSelectCheapest}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 shadow-sm transition"
              >
                <span>⚡ Auto-Select Lowest Price for All</span>
              </button>
              <button
                onClick={onAutoSelectFastest}
                className="bg-sky-600 hover:bg-sky-700 text-white font-black px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 shadow-sm transition"
              >
                <span>🚀 Auto-Select Fastest SLA for All</span>
              </button>
            </div>
          </div>

          {/* High-Contrast Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-inner">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-900 text-white uppercase font-black text-[11px] tracking-wider">
                <tr>
                  <th className="py-3 px-3.5">#</th>
                  <th className="py-3 px-3.5">Dest PIN / City</th>
                  <th className="py-3 px-3.5">Consignee</th>
                  <th className="py-3 px-3.5">Packages</th>
                  <th className="py-3 px-3.5">Billable Wt</th>
                  <th className="py-3 px-3.5">Carrier</th>
                  <th className="py-3 px-3.5">Freight</th>
                  <th className="py-3 px-3.5">2% Fee</th>
                  <th className="py-3 px-3.5 text-right">Total Outlay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium">
                {bulkManifestList.map((row, idx) => {
                  const quote = row.selectedQuote || row.quotes[0];

                  return (
                    <tr key={row.rowId} className={idx % 2 === 0 ? "bg-white hover:bg-indigo-50/60 transition" : "bg-slate-50/80 hover:bg-indigo-50/60 transition"}>
                      <td className="py-3 px-3.5 font-mono font-bold text-slate-500">{idx + 1}</td>
                      <td className="py-3 px-3.5">
                        <span className="font-mono font-black text-slate-900 block text-xs">{row.dest_pin}</span>
                        <span className="text-[11px] text-slate-500 font-semibold">{getLocalFallbackZone(row.dest_pin).city}</span>
                      </td>
                      <td className="py-3 px-3.5">
                        <span className="font-bold text-slate-900 block">{row.consignee_name}</span>
                        <span className="text-[11px] text-slate-500 truncate max-w-[180px] block">{row.delivery_address}</span>
                      </td>
                      <td className="py-3 px-3.5">
                        <span className="font-black text-indigo-700 block">{row.total_boxes} Box(es)</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {row.boxes.map((b) => `${b.weight}kg`).join(", ")}
                        </span>
                      </td>
                      <td className="py-3 px-3.5">
                        <span className="font-black font-mono text-slate-900 block text-xs">{row.billableWeight} kg</span>
                        {row.hasOmittedDimensions && (
                          <span
                            className="text-[9px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded font-black block mt-0.5"
                            title="Volumetric scanning disputes at carrier hub may incur debit notes if dimensions are omitted."
                          >
                            ⚠️ Dead Wt Used
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3.5">
                        <select
                          value={quote?.vendor?.id || ""}
                          onChange={(e) => onSelectCarrierForRow(row.rowId, e.target.value)}
                          className="bg-white border-2 border-indigo-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:border-indigo-600 focus:outline-none"
                        >
                          {row.quotes.map((q) => (
                            <option key={q.vendor.id} value={q.vendor.id}>
                              {q.vendor.name} ({q.rateCard.sla_days}d - {formatINR(q.breakdown.total)})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-3.5 font-mono font-bold text-slate-800">
                        {formatINR(quote?.breakdown?.freightSubtotal || 0)}
                      </td>
                      <td className="py-3 px-3.5 font-mono text-indigo-700 font-bold">
                        ₹{quote?.breakdown?.platformConvenienceFee || 25}
                      </td>
                      <td className="py-3 px-3.5 font-mono font-black text-right text-emerald-800 text-sm">
                        {formatINR(quote?.breakdown?.total || 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Consolidated Settlement Method */}
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-md space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <span className="text-sm font-black uppercase text-indigo-400 block tracking-wide">
                  Single Consolidated Settlement Method ({bulkManifestList.length} Shipments)
                </span>
                <p className="text-xs text-slate-400 mt-0.5">100% of freight is settled directly with transporters. Platform fee is 2% (min ₹25).</p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <label className={`px-4 py-2 rounded-xl border cursor-pointer font-bold transition ${bulkSettlementMethod === "direct_to_pay" ? "bg-emerald-500 text-slate-950 border-emerald-400" : "bg-slate-800 text-slate-300 border-slate-700"}`}>
                  <input type="radio" checked={bulkSettlementMethod === "direct_to_pay"} onChange={() => setBulkSettlementMethod("direct_to_pay")} className="hidden" />
                  💵 To-Pay POD
                </label>
                <label className={`px-4 py-2 rounded-xl border cursor-pointer font-bold transition ${bulkSettlementMethod === "direct_upi" ? "bg-emerald-500 text-slate-950 border-emerald-400" : "bg-slate-800 text-slate-300 border-slate-700"}`}>
                  <input type="radio" checked={bulkSettlementMethod === "direct_upi"} onChange={() => setBulkSettlementMethod("direct_upi")} className="hidden" />
                  📲 Direct Carrier UPI
                </label>
                <label className={`px-4 py-2 rounded-xl border cursor-pointer font-bold transition ${bulkSettlementMethod === "corporate_credit" ? "bg-emerald-500 text-slate-950 border-emerald-400" : "bg-slate-800 text-slate-300 border-slate-700"}`}>
                  <input type="radio" checked={bulkSettlementMethod === "corporate_credit"} onChange={() => setBulkSettlementMethod("corporate_credit")} className="hidden" />
                  🏢 Monthly GST Credit
                </label>
              </div>
            </div>

            {bulkSettlementMethod === "direct_upi" && (
              <div className="flex items-center space-x-3 text-xs bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                <label className="font-bold text-slate-300 shrink-0">Consolidated UTR Ref:</label>
                <input
                  type="text"
                  value={bulkConsolidatedUtr}
                  onChange={(e) => setBulkConsolidatedUtr(e.target.value)}
                  placeholder="e.g. 409827104928"
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 font-mono text-white flex-1 max-w-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
              <div className="text-xs">
                <span className="text-slate-400">Total Manifest Outlay: </span>
                <strong className="text-xl text-emerald-400 font-mono font-black ml-2">
                  {formatINR(bulkManifestList.reduce((acc, r) => acc + (r.selectedQuote?.breakdown?.total || 0), 0))}
                </strong>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Includes Platform Fee: {formatINR(bulkManifestList.reduce((acc, r) => acc + (r.selectedQuote?.breakdown?.platformConvenienceFee || 25), 0))}
                </span>
              </div>

              <button
                disabled={isBatchProcessing}
                onClick={onConfirmBatchBooking}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-7 py-3.5 rounded-xl text-xs transition shadow-lg flex items-center space-x-2"
              >
                <CheckCircleIcon className="w-5 h-5 text-slate-950" />
                <span>{isBatchProcessing ? "Assigning Carrier Dockets..." : `Confirm & Book All ${bulkManifestList.length} Shipments`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
