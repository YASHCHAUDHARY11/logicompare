"use client";

import React, { useMemo } from "react";
import { Booking } from "@/types/freight";
import { DocumentIcon, ExternalLinkIcon, SearchIcon, CheckCircleIcon } from "@/components/icons";
import { getOfficialCarrierTrackingUrl } from "@/lib/freightUtils";
import { DEMO_INIT_ORDER_ID, DEMO_INIT_CARRIER_DOCKET } from "@/lib/constants";

interface UniversalTrackerTabProps {
  bookings: Booking[];
  activeTrackingAwb: string;
  setActiveTrackingAwb: (val: string) => void;
  trackingSearchInput: string;
  setTrackingSearchInput: (val: string) => void;
}

export function UniversalTrackerTab({
  bookings,
  activeTrackingAwb,
  setActiveTrackingAwb,
  trackingSearchInput,
  setTrackingSearchInput
}: UniversalTrackerTabProps) {
  const activeTrackBooking = useMemo(() => {
    const input = activeTrackingAwb.trim().toLowerCase();
    return bookings.find(
      (b) =>
        (b.order_id && b.order_id.toLowerCase() === input) ||
        (b.carrier_docket_no && b.carrier_docket_no.toLowerCase() === input) ||
        b.awb_number.toLowerCase() === input
    );
  }, [bookings, activeTrackingAwb]);

  const stages = ["Booked", "Picked Up", "In Transit", "Out for Delivery", "Delivered"];

  const currentStageIndex = useMemo(() => {
    if (!activeTrackBooking) return 0;
    const idx = stages.indexOf(activeTrackBooking.status);
    return idx === -1 ? 0 : idx;
  }, [activeTrackBooking]);

  return (
    <div className="space-y-6">
      {/* 1. Universal Search Input Box */}
      <div className="bg-white border border-slate-300 rounded-2xl p-6 shadow-sm space-y-3">
        <h2 className="text-base font-black text-slate-900">Universal Consignment Live Tracker</h2>
        <p className="text-xs text-slate-500">
          Enter either your Platform Order Ref (e.g. <strong className="text-indigo-600">{DEMO_INIT_ORDER_ID}</strong>) or official Carrier Docket No. (e.g. <strong className="text-indigo-600">{DEMO_INIT_CARRIER_DOCKET}</strong>)
        </p>

        <div className="flex gap-2 max-w-md">
          <input
            type="text"
            value={trackingSearchInput}
            onChange={(e) => setTrackingSearchInput(e.target.value)}
            placeholder="Enter Order Ref or Docket..."
            className="flex-1 bg-white border-2 border-slate-300 rounded-xl px-3.5 py-2 text-sm font-mono font-bold text-slate-900 focus:border-indigo-600 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setActiveTrackingAwb(trackingSearchInput)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-5 py-2.5 rounded-xl text-xs shadow-md transition flex items-center space-x-1.5"
          >
            <SearchIcon className="w-4 h-4" />
            <span>Track</span>
          </button>
        </div>
      </div>

      {/* 2. Tracking Card Details */}
      {activeTrackBooking ? (
        <div className="bg-white border border-slate-300 rounded-2xl p-6 space-y-8 shadow-sm">
          {/* Header Summary */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <div className="flex items-center space-x-3">
                <span className="text-xl font-mono font-black text-indigo-700">
                  {activeTrackBooking.order_id || "LC-CONSIGNMENT"}
                </span>
                <span className="text-sm font-mono font-black text-slate-800 bg-slate-100 border border-slate-300 px-2.5 py-1 rounded-lg">
                  Carrier Docket: {activeTrackBooking.carrier_docket_no || activeTrackBooking.awb_number}
                </span>
                <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs px-3 py-1 rounded-full font-black uppercase">
                  {activeTrackBooking.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2 font-medium">
                Carrier Partner: <strong className="text-slate-900">{activeTrackBooking.vendors?.name || "Delhivery B2B Express"}</strong>
              </p>
            </div>

            <div className="flex flex-col sm:items-end gap-2.5">
              <div className="flex items-center space-x-2">
                {activeTrackBooking.carrier_docket_doc_url && (
                  <a
                    href={activeTrackBooking.carrier_docket_doc_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold text-xs px-3.5 py-2 rounded-xl transition shadow-xs flex items-center space-x-1.5"
                  >
                    <DocumentIcon className="w-3.5 h-3.5" />
                    <span>View Physical Bilty Scan</span>
                  </a>
                )}
                <a
                  href={
                    activeTrackBooking.carrier_portal_url ||
                    getOfficialCarrierTrackingUrl(
                      activeTrackBooking.vendors?.name || "Delhivery",
                      activeTrackBooking.carrier_docket_no || activeTrackBooking.awb_number
                    )
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-4 py-2 rounded-xl transition shadow-sm flex items-center space-x-1.5"
                >
                  <span>Official Carrier Portal</span>
                  <ExternalLinkIcon className="w-3.5 h-3.5" />
                </a>
              </div>
              <span className="text-xs text-slate-600">
                Route: <strong className="text-slate-900 font-mono">{activeTrackBooking.origin_pin} → {activeTrackBooking.dest_pin}</strong>
              </span>
            </div>
          </div>

          {/* Visual Milestone Progress Bar */}
          <div className="py-2">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-6">Delivery Milestone Pipeline</h4>
            <div className="grid grid-cols-5 gap-2 relative">
              {stages.map((stage, idx) => {
                const isPassed = idx <= currentStageIndex;
                const isCurrent = idx === currentStageIndex;

                return (
                  <div key={stage} className="flex flex-col items-center text-center space-y-2">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-sm ${
                        isPassed
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-200 text-slate-500"
                      } ${isCurrent ? "ring-4 ring-emerald-200 scale-110" : ""}`}
                    >
                      {isPassed ? <CheckCircleIcon className="w-4 h-4" /> : idx + 1}
                    </div>
                    <span className={`text-[11px] font-bold ${isPassed ? "text-slate-900 font-black" : "text-slate-400"}`}>
                      {stage}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Milestone Audit History Timeline */}
          <div className="border-t border-slate-200 pt-6">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4">Milestone Audit Log</h4>
            <div className="space-y-3">
              {(activeTrackBooking.tracking_history || []).map((step, idx) => (
                <div key={idx} className="flex items-start space-x-3 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 mt-1.5 shrink-0"></div>
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex-1 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-black text-slate-900 text-xs">{step.status}</span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {new Date(step.timestamp).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                      </span>
                    </div>
                    <p className="text-indigo-800 font-bold mt-0.5">{step.location}</p>
                    <p className="text-slate-600 mt-1">{step.remarks}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-300 rounded-2xl p-10 text-center shadow-sm">
          <p className="text-slate-600 text-sm font-medium">
            Consignment identifier <strong className="text-slate-900">"{activeTrackingAwb}"</strong> not found.
          </p>
        </div>
      )}
    </div>
  );
}
