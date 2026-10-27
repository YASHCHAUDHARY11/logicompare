"use client";

import React, { useState } from "react";
import { UserProfile, RateCard, Vendor } from "@/types/freight";
import { XMarkIcon } from "@/components/icons";
import { supabase } from "@/lib/supabaseClient";

interface AddRateCardModalProps {
  currentUser: UserProfile;
  vendors: Vendor[];
  onSuccess: (card: RateCard) => void;
  onClose: () => void;
}

export function AddRateCardModal({ currentUser, vendors, onSuccess, onClose }: AddRateCardModalProps) {
  const [card, setCard] = useState({
    origin_prefix: "110",
    dest_prefix: "400",
    mode: "surface" as "surface" | "air" | "ftl",
    min_weight_kg: 10,
    base_rate: 400,
    per_kg_rate: 14,
    fuel_surcharge_pct: 12,
    docket_charge: 150,
    fov_pct: 0.2,
    oda_charge: 450,
    handling_per_kg: 2,
    sla_days: 3
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const vendorId = currentUser.vendor_id || "11111111-1111-1111-1111-111111111111";
    const payload = { ...card, vendor_id: vendorId, is_active: true };

    try {
      const { data, error } = await supabase.from("rate_cards").insert([payload]).select("*, vendors(*)");
      if (!error && data && data[0]) {
        onSuccess(data[0] as RateCard);
      } else {
        const localCard: RateCard = {
          ...(payload as RateCard),
          id: `rc-${Date.now()}`,
          vendors: vendors.find((v) => v.id === vendorId)
        };
        onSuccess(localCard);
      }
      onClose();
    } catch {
      // Ignored
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-xl">
        <div className="flex justify-between border-b pb-3">
          <h3 className="text-base font-bold text-slate-900">Publish New Commercial Rate Tariff</h3>
          <button onClick={onClose}><XMarkIcon className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block mb-1">Origin Prefix</label>
            <input type="text" value={card.origin_prefix} onChange={(e) => setCard({ ...card, origin_prefix: e.target.value })} className="w-full border rounded p-2" required />
          </div>
          <div>
            <label className="block mb-1">Dest Prefix</label>
            <input type="text" value={card.dest_prefix} onChange={(e) => setCard({ ...card, dest_prefix: e.target.value })} className="w-full border rounded p-2" required />
          </div>
          <div>
            <label className="block mb-1">Mode</label>
            <select value={card.mode} onChange={(e) => setCard({ ...card, mode: e.target.value as any })} className="w-full border rounded p-2">
              <option value="surface">Surface Express</option>
              <option value="air">Air Cargo</option>
              <option value="ftl">Full Truck Load (FTL)</option>
            </select>
          </div>
          <div>
            <label className="block mb-1">Transit SLA (Days)</label>
            <input type="number" value={card.sla_days} onChange={(e) => setCard({ ...card, sla_days: Number(e.target.value) })} className="w-full border rounded p-2" required />
          </div>
          <div>
            <label className="block mb-1">Base Rate (₹)</label>
            <input type="number" value={card.base_rate} onChange={(e) => setCard({ ...card, base_rate: Number(e.target.value) })} className="w-full border rounded p-2" required />
          </div>
          <div>
            <label className="block mb-1">Rate Per Kg (₹)</label>
            <input type="number" step={0.1} value={card.per_kg_rate} onChange={(e) => setCard({ ...card, per_kg_rate: Number(e.target.value) })} className="w-full border rounded p-2" required />
          </div>
          <div>
            <label className="block mb-1">Fuel Surcharge (%)</label>
            <input type="number" step={0.5} value={card.fuel_surcharge_pct} onChange={(e) => setCard({ ...card, fuel_surcharge_pct: Number(e.target.value) })} className="w-full border rounded p-2" required />
          </div>
          <div>
            <label className="block mb-1">Docket Charge (₹)</label>
            <input type="number" value={card.docket_charge} onChange={(e) => setCard({ ...card, docket_charge: Number(e.target.value) })} className="w-full border rounded p-2" required />
          </div>
          <div className="col-span-2 flex justify-end space-x-2 pt-2 border-t">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-slate-600">Cancel</button>
            <button type="submit" className="bg-emerald-600 text-white font-bold px-4 py-1.5 rounded text-xs">Publish Tariff</button>
          </div>
        </form>
      </div>
    </div>
  );
}
