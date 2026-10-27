
"use client";

import React, { useMemo } from "react";
import { Booking } from "@/types/freight";
import { DocumentIcon, ExternalLinkIcon } from "@/components/icons";
import { getOfficialCarrierTrackingUrl } from "@/lib/freightUtils";

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

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <h2 className="text-base font-bold text-slate-900 mb-1">Universal Consignment Live Tracker</h2>
        <p className="text-xs text-slate-500 mb-4">
          Enter either your Platform Order Ref (e.g. LC-894210) or official Carrier Docket No. (e.g. 148920194821)
        </p>

        <div className="flex gap-2 max-w-md">
          <input
            type="text"
            value={trackingSearchInput}
            onChange={(e) => setTrackingSearchInput(e.target.value)}
            placeholder="Enter Order Ref or Docket..."
            className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none"
          />
          <button
            onClick={() => setActiveTrackingAwb(trackingSearchInput)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-xs"
          >
            Track Shipment
          </button>
        </div>
      </div>

      {activeTrackBooking ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-8 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center space-x-3">
                <span className="text-xl font-mono font-black text-indigo-700">
                  {activeTrackBooking.order_id || "LC-CONSIGNMENT"}
                </span>
                <span className="text-base font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  Docket: {activeTrackBooking.carrier_docket_no || activeTrackBooking.awb_number}
                </span>
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-2.5 py-0.5 rounded-full font-bold uppercase">
                  {activeTrackBooking.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                Carrier Partner: <strong className="text-slate-800">{activeTrackBooking.vendors?.name || "Delhivery B2B Express"}</strong>
              </p>
            </div>

            <div className="flex flex-col sm:items-end gap-2">
              <div className="flex items-center space-x-2">
                {activeTrackBooking.carrier_docket_doc_url && (
                  <a
                    href={activeTrackBooking.carrier_docket_doc_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold text-xs px-3 py-2 rounded-xl transition shadow-xs flex items-center space-x-1.5"
                  >
                    <DocumentIcon className="w-3.5 h-3.5" />
                    <span>View Physical Bilty / LR</span>
                  </a>
                )}
                <a
                  href={activeTrackBooking.carrier_portal_url || getOfficialCarrierTrackingUrl(activeTrackBooking.vendors?.name || "Delhivery", activeTrackBooking.carrier_docket_no || activeTrackBooking.awb_number)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-sm flex items-center space-x-1.5 w-fit"
                >
                  <span>Official Carrier Tracking Portal</span>
                  <ExternalLinkIcon className="w-3.5 h-3.5" />
                </a>
              </div>
              <span className="text-[11px] text-slate-500">
                Route: <strong className="text-slate-800 font-mono">{activeTrackBooking.origin_pin} → {activeTrackBooking.dest_pin}</strong>
              </span>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Milestone Audit Logs</h4>
            <div className="space-y-3">
              {(activeTrackBooking.tracking_history || []).map((step, idx) => (
                <div key={idx} className="flex items-start space-x-3 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 mt-1 shrink-0"></div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-slate-900">{step.status}</span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {new Date(step.timestamp).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                      </span>
                    </div>
                    <p className="text-indigo-700 font-medium mt-0.5">{step.location}</p>
                    <p className="text-slate-600 mt-1">{step.remarks}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-xs">
          <p className="text-slate-500 text-sm">Consignment identifier not found.</p>
        </div>
      )}
    </div>
  );
}
