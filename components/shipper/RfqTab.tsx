
"use client";

import React, { useState } from "react";
import { UserProfile, RfqBid } from "@/types/freight";
import { supabase } from "@/lib/supabaseClient";

interface RfqTabProps {
  currentUser: UserProfile;
  rfqList: RfqBid[];
  setRfqList: React.Dispatch<React.SetStateAction<RfqBid[]>>;
}

export function RfqTab({ currentUser, rfqList, setRfqList }: RfqTabProps) {
  const [newRfqOrigin, setNewRfqOrigin] = useState("110001");
  const [newRfqDest, setNewRfqDest] = useState("560001");
  const [newRfqDesc, setNewRfqDesc] = useState("Industrial Gearboxes and Heavy Machinery Parts");
  const [newRfqWeight, setNewRfqWeight] = useState(8500);
  const [newRfqTruck, setNewRfqTruck] = useState("32ft Multi-Axle Trailer (MXL)");
  const [newRfqBudget, setNewRfqBudget] = useState(65000);

  const handleCreateRfq = async (e: React.FormEvent) => {
    e.preventDefault();
    const newRecord: Partial<RfqBid> = {
      shipper_name: currentUser.company_name || currentUser.full_name,
      origin_pin: newRfqOrigin,
      dest_pin: newRfqDest,
      cargo_description: newRfqDesc,
      total_weight_kg: Number(newRfqWeight),
      truck_type: newRfqTruck,
      target_price: Number(newRfqBudget),
      status: "Open",
      bids: []
    };

    try {
      const { data, error } = await supabase.from("rfq_bids").insert([newRecord]).select();
      if (!error && data && data[0]) {
        setRfqList([data[0] as RfqBid, ...rfqList]);
      } else {
        const localRfq: RfqBid = {
          ...(newRecord as RfqBid),
          id: `rfq-${Date.now()}`,
          created_at: new Date().toISOString()
        };
        setRfqList([localRfq, ...rfqList]);
      }
      alert("Load successfully posted for reverse bidding!");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
      <div>
        <h2 className="text-base font-bold text-slate-900 mb-1">Post Heavy/FTL Cargo Load for Reverse Auction</h2>
        <p className="text-xs text-slate-500">
          Carriers and fleet operators will bid competitively below your ceiling target price.
        </p>
      </div>

      <form onSubmit={handleCreateRfq} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Origin Pincode</label>
          <input
            type="text"
            maxLength={6}
            value={newRfqOrigin}
            onChange={(e) => setNewRfqOrigin(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Destination Pincode</label>
          <input
            type="text"
            maxLength={6}
            value={newRfqDest}
            onChange={(e) => setNewRfqDest(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Cargo Description</label>
          <input
            type="text"
            value={newRfqDesc}
            onChange={(e) => setNewRfqDesc(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Total Weight (Kg)</label>
          <input
            type="number"
            value={newRfqWeight}
            onChange={(e) => setNewRfqWeight(Number(e.target.value))}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Required Truck Type</label>
          <select
            value={newRfqTruck}
            onChange={(e) => setNewRfqTruck(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900"
          >
            <option value="32ft Multi-Axle Trailer (MXL)">32ft Multi-Axle Trailer (MXL)</option>
            <option value="24ft Container Truck">24ft Container Truck</option>
            <option value="Taurus 21-Tonner (10-Tyre)">Taurus 21-Tonner (10-Tyre)</option>
            <option value="19ft Open Body Truck">19ft Open Body Truck</option>
            <option value="Tata 407 (3.5T)">Tata 407 (3.5T)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Ceiling Target Budget (₹)</label>
          <input
            type="number"
            value={newRfqBudget}
            onChange={(e) => setNewRfqBudget(Number(e.target.value))}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900"
            required
          />
        </div>

        <div className="md:col-span-3 flex justify-end">
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-lg text-xs transition shadow-sm"
          >
            Broadcast RFQ to Verified Carriers
          </button>
        </div>
      </form>
    </div>
  );
}
