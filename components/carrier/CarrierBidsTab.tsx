
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
      alert("Please provide bid price and transit SLA days");
      return;
    }

    const rfq = rfqList.find((r) => r.id === rfqId);
    if (!rfq) return;

    const newBidObj = {
      vendor_name: currentUser.company_name || "Delhivery B2B Express",
      bid_amount: Number(form.amount),
      transit_days: Number(form.days),
      notes: form.notes || "Ready container vehicle with GPS tracking.",
      created_at: new Date().toISOString()
    };

    const updatedBids = [...(rfq.bids || []), newBidObj];

    try {
      await supabase.from("rfq_bids").update({ bids: updatedBids }).eq("id", rfqId);
      setRfqList(rfqList.map((r) => (r.id === rfqId ? { ...r, bids: updatedBids } : r)));
      setBidFormMap({ ...bidFormMap, [rfqId]: { amount: 0, days: 0, notes: "" } });
      alert("Bid placed successfully!");
    } catch (err) {
      console.error("Failed to submit bid", err);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-slate-900">Live Heavy Cargo RFQ Exchange</h2>
      <div className="grid grid-cols-1 gap-4">
        {rfqList.map((rfq) => {
          const form = bidFormMap[rfq.id] || { amount: 0, days: 0, notes: "" };

          return (
            <div key={rfq.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded font-mono font-bold">
                    PIN {rfq.origin_pin} → {rfq.dest_pin}
                  </span>
                  <h4 className="text-base font-bold text-slate-900 mt-1">{rfq.cargo_description}</h4>
                </div>

                <div className="text-right">
                  <span className="text-base font-black text-emerald-700">{formatINR(rfq.target_price)}</span>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <span className="text-xs font-bold text-slate-700 block">Submit Competitive Carrier Quote</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">Quoted Price (₹)</label>
                    <input
                      type="number"
                      placeholder="e.g. 72000"
                      value={form.amount || ""}
                      onChange={(e) =>
                        setBidFormMap({
                          ...bidFormMap,
                          [rfq.id]: { ...form, amount: Number(e.target.value) }
                        })
                      }
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">Transit SLA (Days)</label>
                    <input
                      type="number"
                      placeholder="e.g. 4"
                      value={form.days || ""}
                      onChange={(e) =>
                        setBidFormMap({
                          ...bidFormMap,
                          [rfq.id]: { ...form, days: Number(e.target.value) }
                        })
                      }
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">Fleet / Driver Notes</label>
                    <input
                      type="text"
                      placeholder="e.g. Dedicated container vehicle ready"
                      value={form.notes}
                      onChange={(e) =>
                        setBidFormMap({
                          ...bidFormMap,
                          [rfq.id]: { ...form, notes: e.target.value }
                        })
                      }
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => handleSubmitVendorBid(rfq.id)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition shadow-xs"
                  >
                    Place Official Bid
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
