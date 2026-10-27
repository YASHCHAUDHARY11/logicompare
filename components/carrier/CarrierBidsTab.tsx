"use client";

import React, { useState } from "react";
import { RfqBid, UserProfile } from "@/types/freight";
import { formatINR } from "@/lib/freightUtils";
import { supabase } from "@/lib/supabaseClient";

interface CarrierBidsTabProps {
  currentUser: UserProfile;
  rfqList: RfqBid[];
  setRfqList: React.Dispatch<React.SetStateAction<RfqBid[]>>;
}

export function CarrierBidsTab({ currentUser, rfqList, setRfqList }: CarrierBidsTabProps) {
  const [bidFormMap, setBidFormMap] = useState<Record<string, { amount: number; days: number; notes: string }>>({});

  const handleSubmitVendorBid = async (rfqId: string) => {
    const form = bidFormMap[rfqId];
    if (!form || !form.amount || !form.days) {
      alert("Please provide both quote price and transit SLA days.");
      return;
    }

    const rfq = rfqList.find((r) => r.id === rfqId);
    if (!rfq) return;

    const newBidObj = {
      vendor_name: currentUser.company_name || "Delhivery B2B Express",
      bid_amount: Number(form.amount),
      transit_days: Number(form.days),
      notes: form.notes || "Ready dedicated container vehicle with GPS tracking.",
      created_at: new Date().toISOString()
    };

    const updatedBids = [...(rfq.bids || []), newBidObj];

    try {
      await supabase.from("rfq_bids").update({ bids: updatedBids }).eq("id", rfqId);
      setRfqList(rfqList.map((r) => (r.id === rfqId ? { ...r, bids: updatedBids } : r)));
      setBidFormMap({ ...bidFormMap, [rfqId]: { amount: 0, days: 0, notes: "" } });
      alert("Bid placed successfully on the live RFQ exchange!");
    } catch (err) {
      console.error("Failed to submit bid:", err);
      setRfqList(rfqList.map((r) => (r.id === rfqId ? { ...r, bids: updatedBids } : r)));
      setBidFormMap({ ...bidFormMap, [rfqId]: { amount: 0, days: 0, notes: "" } });
      alert("Bid recorded locally!");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-black text-slate-900">Live Heavy Cargo RFQ Exchange</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Browse verified commercial shipper loads and submit competitive linehaul quotes below target budgets.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {rfqList.length === 0 ? (
          <div className="bg-white border border-slate-300 rounded-2xl p-10 text-center text-slate-500 text-xs shadow-sm">
            No live shipper RFQ loads available right now.
          </div>
        ) : (
          rfqList.map((rfq) => {
            const form = bidFormMap[rfq.id] || { amount: 0, days: 0, notes: "" };

            return (
              <div key={rfq.id} className="bg-white border-2 border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded font-mono font-black">
                        PIN {rfq.origin_pin} → {rfq.dest_pin}
                      </span>
                      <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">
                        {rfq.truck_type}
                      </span>
                    </div>
                    <h4 className="text-base font-black text-slate-900 mt-1.5">{rfq.cargo_description}</h4>
                    <p className="text-xs text-slate-500 font-medium">
                      Shipper: {rfq.shipper_name} • Weight: {rfq.total_weight_kg.toLocaleString()} kg
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider block">Shipper Target Budget</span>
                    <span className="text-xl font-black text-emerald-700 font-mono">{formatINR(rfq.target_price)}</span>
                  </div>
                </div>

                {/* Submit Bid Form Tile */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <span className="text-xs font-black text-slate-800 block uppercase tracking-wider">
                    Submit Competitive Carrier Quote
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Quoted Price (₹)</label>
                      <input
                        type="number"
                        placeholder="e.g. 58000"
                        value={form.amount || ""}
                        onChange={(e) =>
                          setBidFormMap({
                            ...bidFormMap,
                            [rfq.id]: { ...form, amount: Number(e.target.value) }
                          })
                        }
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:border-indigo-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Transit SLA (Days)</label>
                      <input
                        type="number"
                        placeholder="e.g. 3"
                        value={form.days || ""}
                        onChange={(e) =>
                          setBidFormMap({
                            ...bidFormMap,
                            [rfq.id]: { ...form, days: Number(e.target.value) }
                          })
                        }
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:border-indigo-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Fleet / Driver Notes</label>
                      <input
                        type="text"
                        placeholder="e.g. Dedicated trailer ready at hub"
                        value={form.notes}
                        onChange={(e) =>
                          setBidFormMap({
                            ...bidFormMap,
                            [rfq.id]: { ...form, notes: e.target.value }
                          })
                        }
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-medium focus:border-indigo-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => handleSubmitVendorBid(rfq.id)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-2 rounded-xl transition shadow-sm"
                    >
                      Place Official Bid
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
