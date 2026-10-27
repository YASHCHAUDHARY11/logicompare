
"use client";

import React, { useState } from "react";
import { UserProfile, Vendor } from "@/types/freight";
import { CreditCardIcon, CheckCircleIcon } from "@/components/icons";
import { supabase } from "@/lib/supabaseClient";

interface CarrierBankTabProps {
  currentUser: UserProfile;
  vendors: Vendor[];
  setVendors: React.Dispatch<React.SetStateAction<Vendor[]>>;
}

export function CarrierBankTab({ currentUser, vendors, setVendors }: CarrierBankTabProps) {
  const currentVendor = vendors.find((v) => v.id === (currentUser.vendor_id || "11111111-1111-1111-1111-111111111111")) || vendors[0];

  const [upi, setUpi] = useState(currentVendor?.upi_id || "delhivery.b2b@icici");
  const [bankAcc, setBankAcc] = useState(currentVendor?.bank_account || "50200088910234");
  const [ifsc, setIfsc] = useState(currentVendor?.ifsc_code || "HDFC0000240");
  const [beneficiary, setBeneficiary] = useState(currentVendor?.beneficiary_name || "Delhivery Limited B2B Logistics");
  const [isSaving, setIsSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMsg("");

    const vendorId = currentUser.vendor_id || "11111111-1111-1111-1111-111111111111";
    const payload = {
      upi_id: upi.trim(),
      bank_account: bankAcc.trim(),
      ifsc_code: ifsc.trim().toUpperCase(),
      beneficiary_name: beneficiary.trim()
    };

    try {
      await supabase.from("vendors").update(payload).eq("id", vendorId);
      setVendors((prev) => prev.map((v) => (v.id === vendorId ? { ...v, ...payload } : v)));
      setMsg("Bank and UPI settlement details saved successfully! Shippers can now pay you directly.");
    } catch {
      setVendors((prev) => prev.map((v) => (v.id === vendorId ? { ...v, ...payload } : v)));
      setMsg("Settlement details saved locally!");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm max-w-2xl">
      <div className="border-b border-slate-100 pb-4 mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <CreditCardIcon className="w-5 h-5 text-emerald-600" />
            <span>Direct Freight Settlement Details</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure where Shippers send 100% direct freight payments when booking your routes.
          </p>
        </div>
        <span className="bg-emerald-50 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200">
          Zero Commission on Freight
        </span>
      </div>

      {msg && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
          {msg}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4 text-xs">
        <div>
          <label className="block text-slate-700 font-bold mb-1">
            Official Transporter UPI ID (VPA)
          </label>
          <input
            type="text"
            required
            value={upi}
            onChange={(e) => setUpi(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-mono text-slate-900 font-bold"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-700 font-bold mb-1">Bank Account Number</label>
            <input
              type="text"
              required
              value={bankAcc}
              onChange={(e) => setBankAcc(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-mono text-slate-900"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Bank IFSC Code</label>
            <input
              type="text"
              required
              maxLength={11}
              value={ifsc}
              onChange={(e) => setIfsc(e.target.value.toUpperCase())}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-mono uppercase text-slate-900"
            />
          </div>
        </div>

        <div>
          <label className="block text-slate-700 font-bold mb-1">Beneficiary Name</label>
          <input
            type="text"
            required
            value={beneficiary}
            onChange={(e) => setBeneficiary(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900 font-semibold"
          />
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition shadow-sm flex items-center space-x-1.5"
          >
            <CheckCircleIcon className="w-4 h-4" />
            <span>{isSaving ? "Saving..." : "Save Bank & UPI Profile"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
