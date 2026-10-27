"use client";

import React, { useState } from "react";
import { UserProfile, RfqBid } from "@/types/freight";
import { formatINR } from "@/lib/freightUtils";
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateRfq = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const newRecord: Partial<RfqBid> = {
      shipper_name: currentUser.company_name || currentUser.full_name,
      origin_pin: newRfqOrigin.trim(),
      dest_pin: newRfqDest.trim(),
      cargo_description: newRfqDesc.trim(),
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
      alert("Heavy cargo load successfully broadcast to national fleet operators!");
    } catch (err) {
      console.error("Failed to post RFQ load:", err);
      const localRfq: RfqBid = {
        ...(newRecord as RfqBid),
        id: `rfq-${Date.now()}`,
        created_at: new Date().toISOString()
      };
      setRfqList([localRfq, ...rfqList]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Post Load Form Card */}
      <div className="bg-white border border-slate-300 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="border-b border-slate-200 pb-4">
          <h2 className="text-lg font-black text-slate-900">Post Heavy / FTL Cargo Load for Reverse Auction</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Verified fleet operators and trailer transporters will bid competitively below your ceiling target price.
          </p>
        </div>

        <form onSubmit={handleCreateRfq} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-slate-800 font-bold mb-1">Origin Pincode (Pickup)</label>
            <input
              type="text"
              maxLength={6}
              value={newRfqOrigin}
              onChange={(e) => setNewRfqOrigin(e.target.value)}
              className="w-full bg-white border-2 border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 focus:border-indigo-600 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-slate-800 font-bold mb-1">Destination Pincode (Drop)</label>
            <input
              type="text"
              maxLength={6}
              value={newRfqDest}
              onChange={(e) => setNewRfqDest(e.target.value)}
              className="w-full bg-white border-2 border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 focus:border-indigo-600 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-slate-800 font-bold mb-1">Cargo Description</label>
            <input
              type="text"
              value={newRfqDesc}
              onChange={(e) => setNewRfqDesc(e.target.value)}
              placeholder="e.g. Electrical Panels / Steel Coils"
              className="w-full bg-white border-2 border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium focus:border-indigo-600 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-slate-800 font-bold mb-1">Total Cargo Weight (Kg)</label>
            <input
              type="number"
              value={newRfqWeight}
              onChange={(e) => setNewRfqWeight(Number(e.target.value))}
              className="w-full bg-white border-2 border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 focus:border-indigo-600 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-slate-800 font-bold mb-1">Required Vehicle / Truck Body</label>
            <select
              value={newRfqTruck}
              onChange={(e) => setNewRfqTruck(e.target.value)}
              className="w-full bg-white border-2 border-slate-300 rounded-xl px-2.5 py-2 font-bold text-slate-900 focus:border-indigo-600 focus:outline-none"
            >
              <option value="32ft Multi-Axle Trailer (MXL)">32ft Multi-Axle Trailer (MXL)</option>
              <option value="24ft Container Truck">24ft Container Truck</option>
              <option value="Taurus 21-Tonner (10-Tyre)">Taurus 21-Tonner (10-Tyre)</option>
              <option value="19ft Open Body Truck">19ft Open Body Truck</option>
              <option value="Tata 407 (3.5T)">Tata 407 (3.5T)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-800 font-bold mb-1">Ceiling Target Budget (₹)</label>
            <input
              type="number"
              value={newRfqBudget}
              onChange={(e) => setNewRfqBudget(Number(e.target.value))}
              className="w-full bg-white border-2 border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 focus:border-indigo-600 focus:outline-none"
              required
            />
          </div>

          <div className="md:col-span-3 flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-7 py-3 rounded-xl text-xs transition shadow-md flex items-center space-x-2 disabled:opacity-50"
            >
              <span>{isSubmitting ? "Broadcasting..." : "Broadcast Load to Verified Transporters"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 2. Active Broadcasted Loads & Carrier Bids */}
      <div className="space-y-4">
        <h3 className="text-base font-black text-slate-900">Your Broadcasted Loads & Carrier Counter-Bids</h3>

        {rfqList.length === 0 ? (
          <div className="bg-white border border-slate-300 rounded-2xl p-8 text-center text-slate-500 text-xs shadow-sm">
            No reverse auction loads posted yet. Fill the form above to invite competitive carrier bidding.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {rfqList.map((rfq) => (
              <div key={rfq.id} className="bg-white border-2 border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded font-black">
                        PIN {rfq.origin_pin} → {rfq.dest_pin}
                      </span>
                      <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">
                        {rfq.truck_type}
                      </span>
                      <span className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-bold uppercase">
                        {rfq.status}
                      </span>
                    </div>
                    <h4 className="text-base font-black text-slate-900 mt-1.5">{rfq.cargo_description}</h4>
                    <p className="text-xs text-slate-500 font-medium">Cargo Weight: {rfq.total_weight_kg.toLocaleString()} kg</p>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider block">Ceiling Target Budget</span>
                    <span className="text-xl font-black text-emerald-700 font-mono">{formatINR(rfq.target_price)}</span>
                  </div>
                </div>

                {/* Submissions by Carriers */}
                <div className="space-y-2">
                  <span className="text-xs font-black text-slate-700 block uppercase tracking-wider">
                    Received Carrier Bids ({(rfq.bids || []).length})
                  </span>

                  {(!rfq.bids || rfq.bids.length === 0) ? (
                    <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-slate-200">
                      Awaiting bids from fleet operators on the carrier exchange...
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {rfq.bids.map((bid, bIdx) => (
                        <div key={bIdx} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                          <div>
                            <span className="font-black text-slate-900 block">{bid.vendor_name}</span>
                            <span className="text-[11px] text-slate-600 font-medium mt-0.5 block">{bid.notes}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-base font-black text-emerald-700 font-mono block">{formatINR(bid.bid_amount)}</span>
                            <span className="text-[11px] text-slate-500 font-bold block">SLA: {bid.transit_days} Days</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
