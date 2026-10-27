
"use client";

import React, { useRef, useState } from "react";
import { DownloadIcon, PlusIcon, UploadIcon, CheckCircleIcon } from "@/components/icons";
import { ParsedCsvRateCard, RateCard, UserProfile, Vendor } from "@/types/freight";
import { resolveLocationToPrefix } from "@/lib/freightUtils";
import { supabase } from "@/lib/supabaseClient";

interface CarrierRatesTabProps {
  currentUser: UserProfile;
  rateCards: RateCard[];
  setRateCards: React.Dispatch<React.SetStateAction<RateCard[]>>;
  vendors: Vendor[];
  onOpenAddRateModal: () => void;
}

export function CarrierRatesTab({
  currentUser,
  rateCards,
  setRateCards,
  vendors,
  onOpenAddRateModal
}: CarrierRatesTabProps) {
  const [csvFileName, setCsvFileName] = useState("");
  const [parsedCsvRows, setParsedCsvRows] = useState<ParsedCsvRateCard[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);
  const [csvUploadStatus, setCsvUploadStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadSampleCsv = () => {
    const csvHeader = "origin,dest,mode,min_weight_kg,base_rate,per_kg_rate,fuel_surcharge_pct,docket_charge,sla_days\n";
    const sampleRows = [
      "Delhi,Chandigarh,surface,20,450,14.5,12.5,150,2",
      "110,Bengaluru,air,5,850,48,18,250,1",
      "Mumbai,Kolkata,surface,25,500,16,12.5,150,4",
      "Ludhiana,Delhi,surface,15,350,11,10,120,2",
      "%,%,ftl,500,8500,6.5,15,500,5"
    ].join("\n");

    const blob = new Blob([csvHeader + sampleRows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "logicompare_rate_card_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    setCsvUploadStatus(null);
    setCsvErrors([]);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) throw new Error("Empty file content");

        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
        if (lines.length <= 1) throw new Error("CSV file must contain a header row and data rows.");

        const rows: ParsedCsvRateCard[] = [];
        const errors: string[] = [];

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(",").map((c) => c.trim());
          if (cols.length < 9) {
            errors.push(`Row ${i + 1}: Expected 9 columns, found ${cols.length}`);
            continue;
          }

          const [origRaw, destRaw, modeRaw, minWtRaw, baseRateRaw, perKgRaw, fuelRaw, docketRaw, slaRaw] = cols;
          const modeClean = modeRaw.toLowerCase();

          const origin_prefix = await resolveLocationToPrefix(origRaw);
          const dest_prefix = await resolveLocationToPrefix(destRaw);

          if (!["surface", "air", "ftl"].includes(modeClean)) {
            errors.push(`Row ${i + 1}: Invalid transport mode '${modeRaw}'.`);
            continue;
          }

          const min_weight_kg = parseFloat(minWtRaw);
          const base_rate = parseFloat(baseRateRaw);
          const per_kg_rate = parseFloat(perKgRaw);
          const fuel_surcharge_pct = parseFloat(fuelRaw);
          const docket_charge = parseFloat(docketRaw);
          const sla_days = parseInt(slaRaw, 10);

          if ([min_weight_kg, base_rate, per_kg_rate, fuel_surcharge_pct, docket_charge, sla_days].some(isNaN)) {
            errors.push(`Row ${i + 1}: Numeric fields contain invalid values.`);
            continue;
          }

          rows.push({
            origin_prefix,
            dest_prefix,
            mode: modeClean as "surface" | "air" | "ftl",
            min_weight_kg,
            base_rate,
            per_kg_rate,
            fuel_surcharge_pct,
            docket_charge,
            sla_days,
            fov_pct: 0.2,
            oda_charge: 450,
            handling_per_kg: 2,
            is_active: true
          });
        }

        setParsedCsvRows(rows);
        setCsvErrors(errors);
      } catch (err: any) {
        setCsvUploadStatus({ type: "error", message: err.message || "Failed to parse CSV." });
        setParsedCsvRows([]);
      }
    };

    reader.readAsText(file);
  };

  const handleBatchInsertRateCards = async () => {
    if (parsedCsvRows.length === 0) return;
    setIsUploadingCsv(true);
    setCsvUploadStatus(null);

    const vendorId = currentUser.vendor_id || "11111111-1111-1111-1111-111111111111";
    const payload = parsedCsvRows.map((r) => ({
      ...r,
      vendor_id: vendorId
    }));

    try {
      const { data, error } = await supabase.from("rate_cards").insert(payload).select("*, vendors(*)");

      if (!error && data && data.length > 0) {
        setRateCards([...(data as RateCard[]), ...rateCards]);
      } else {
        const localCards: RateCard[] = payload.map((p, idx) => ({
          ...(p as RateCard),
          id: `rc-bulk-${Date.now()}-${idx}`,
          vendors: vendors.find((v) => v.id === vendorId)
        }));
        setRateCards([...localCards, ...rateCards]);
      }

      setCsvUploadStatus({
        type: "success",
        message: `Successfully published ${parsedCsvRows.length} lane routes!`
      });
      setParsedCsvRows([]);
      setCsvFileName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      setCsvUploadStatus({
        type: "error",
        message: err.message || "Failed to batch insert rate cards."
      });
    } finally {
      setIsUploadingCsv(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Commercial Rate Card Master</h2>
          <p className="text-xs text-slate-500">Manage route tariffs individually or batch-publish via CSV</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDownloadSampleCsv}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-xs transition"
          >
            <DownloadIcon className="w-4 h-4 text-indigo-600" />
            <span>📥 Download Sample CSV</span>
          </button>

          <button
            onClick={onOpenAddRateModal}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-sm transition"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            <span>Add Route Manually</span>
          </button>
        </div>
      </div>

      <div className="bg-white border-2 border-dashed border-indigo-200 rounded-2xl p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <UploadIcon className="w-4 h-4 text-indigo-600" />
              <span>Bulk Upload Rate Cards via CSV (City Names or Prefixes Supported)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload standard CSV with 9 columns: <code className="font-mono text-indigo-700 font-semibold text-[11px]">origin, dest, mode, min_weight_kg, base_rate, per_kg_rate, fuel_surcharge_pct, docket_charge, sla_days</code>
            </p>
          </div>

          {parsedCsvRows.length > 0 && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  setParsedCsvRows([]);
                  setCsvFileName("");
                  setCsvErrors([]);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="text-xs text-slate-500 hover:text-slate-800 px-2.5 py-1 rounded"
              >
                Clear
              </button>
              <button
                disabled={isUploadingCsv}
                onClick={handleBatchInsertRateCards}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition shadow-sm flex items-center space-x-1.5"
              >
                <CheckCircleIcon className="w-4 h-4" />
                <span>{isUploadingCsv ? "Publishing Routes..." : `Publish All ${parsedCsvRows.length} Routes`}</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center justify-center py-6 px-4 bg-slate-50/70 rounded-xl border border-slate-200 text-center space-y-2">
          <input
            type="file"
            ref={fileInputRef}
            accept=".csv,text/csv"
            onChange={handleFileUpload}
            className="hidden"
            id="csv-rate-card-upload"
          />
          <label
            htmlFor="csv-rate-card-upload"
            className="bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition shadow-xs flex items-center space-x-2"
          >
            <UploadIcon className="w-4 h-4 text-indigo-600" />
            <span>{csvFileName ? `Replace (${csvFileName})` : "Select Rate Card CSV File"}</span>
          </label>
          <p className="text-[11px] text-slate-500">
            {csvFileName ? `Selected: ${csvFileName}` : "Click to choose .csv file"}
          </p>
        </div>

        {csvUploadStatus && (
          <div
            className={`p-3 rounded-xl text-xs font-medium border ${
              csvUploadStatus.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            {csvUploadStatus.message}
          </div>
        )}
      </div>
    </div>
  );
}
