"use client";

import React from "react";
import { Booking } from "@/types/freight";
import { formatINR, getOfficialCarrierTrackingUrl } from "@/lib/freightUtils";
import { DocumentIcon, ExternalLinkIcon, PrinterIcon } from "@/components/icons";

interface ShipmentsTabProps {
  bookings: Booking[];
  onRefresh: () => void;
  onOpenLabelModal: (b: Booking) => void;
  onOpenTrackerTab: (orderRef: string) => void;
  onBatchPrintLabels: () => void;
}

export function ShipmentsTab({
  bookings,
  onRefresh,
  onOpenLabelModal,
  onOpenTrackerTab,
  onBatchPrintLabels
}: ShipmentsTabProps) {
  return (
    <div className="space-y-4">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900">Consignment Manifests & Tracking Logs</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Access internal Order IDs, carrier dockets, printable 4x6 labels, and deep-links to carrier tracking portals
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          {bookings.length > 0 && (
            <button
              type="button"
              onClick={onBatchPrintLabels}
              className="bg-slate-950 hover:bg-slate-800 text-white font-black px-4 py-2.5 rounded-xl text-xs flex items-center space-x-2 shadow-sm transition"
            >
              <PrinterIcon className="w-4 h-4 text-emerald-400" />
              <span>Batch Print 4x6 Labels & Manifest</span>
            </button>
          )}

          <button
            type="button"
            onClick={onRefresh}
            className="bg-white hover:bg-slate-100 text-slate-800 px-4 py-2.5 rounded-xl text-xs font-black border border-slate-300 shadow-sm transition"
          >
            🔄 Refresh List
          </button>
        </div>
      </div>

      {/* 2. Shipments Data Grid */}
      {bookings.length === 0 ? (
        <div className="bg-white border border-slate-300 rounded-2xl p-12 text-center shadow-sm space-y-2">
          <p className="text-slate-800 font-bold text-sm">No shipments booked yet.</p>
          <p className="text-slate-500 text-xs">
            Calculate freight tariffs or upload a bulk CSV to dispatch your first consignment!
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-950 text-white uppercase font-black text-[11px] tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Order Ref / Carrier Docket</th>
                <th className="py-3.5 px-4">Carrier Partner</th>
                <th className="py-3.5 px-4">Route PIN</th>
                <th className="py-3.5 px-4">Freight (Direct)</th>
                <th className="py-3.5 px-4">Physical Bilty</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {bookings.map((booking, idx) => {
                const carrierName = booking.vendors?.name || "Carrier Partner";
                const docketNo = booking.carrier_docket_no || booking.awb_number;
                const orderRef = booking.order_id || booking.id.slice(0, 8);
                const portalUrl = booking.carrier_portal_url || getOfficialCarrierTrackingUrl(carrierName, docketNo);

                return (
                  <tr
                    key={booking.id}
                    className={idx % 2 === 0 ? "bg-white hover:bg-indigo-50/60 transition" : "bg-slate-50 hover:bg-indigo-50/60 transition"}
                  >
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-black text-indigo-700 block text-xs">{orderRef}</span>
                      <span className="font-mono text-[11px] text-slate-600 block mt-0.5">
                        Docket: <strong className="text-slate-900">{docketNo}</strong>
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-black text-slate-900 block">{carrierName}</span>
                      <span className="text-[11px] text-slate-500 font-medium">{booking.consignee_name}</span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-1 font-mono font-bold text-slate-900">
                        <span>{booking.origin_pin}</span>
                        <span className="text-slate-400">→</span>
                        <span>{booking.dest_pin}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block">
                        {booking.boxes?.length || 1} Box(es) • {booking.billable_weight} kg
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-mono font-black text-slate-900 text-sm">
                      {formatINR(booking.cost_breakdown?.freightSubtotal || booking.final_total)}
                    </td>

                    <td className="py-3.5 px-4">
                      {booking.carrier_docket_doc_url ? (
                        <a
                          href={booking.carrier_docket_doc_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center space-x-1 underline text-[11px]"
                        >
                          <DocumentIcon className="w-3.5 h-3.5" />
                          <span>View Bilty Scan</span>
                        </a>
                      ) : (
                        <span className="text-slate-400 text-[10px] font-semibold bg-slate-100 px-2 py-0.5 rounded">
                          Pending Upload
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          booking.status === "Delivered"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : booking.status === "In Transit"
                            ? "bg-sky-100 text-sky-800 border-sky-300"
                            : booking.status === "Picked Up"
                            ? "bg-amber-100 text-amber-800 border-amber-300"
                            : "bg-slate-100 text-slate-700 border-slate-300"
                        }`}
                      >
                        {booking.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right space-x-2">
                      <a
                        href={portalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center space-x-1 shadow-xs transition"
                        title="Open Official Carrier Live Portal"
                      >
                        <span>Carrier Site</span>
                        <ExternalLinkIcon className="w-3 h-3" />
                      </a>
                      <button
                        type="button"
                        onClick={() => onOpenLabelModal(booking)}
                        className="bg-white hover:bg-slate-100 text-slate-800 px-3 py-1.5 rounded-lg text-[11px] font-bold border border-slate-300 inline-flex items-center space-x-1 shadow-xs transition"
                      >
                        <PrinterIcon className="w-3.5 h-3.5 text-slate-600" />
                        <span>Label</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenTrackerTab(orderRef)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center space-x-1 shadow-xs transition"
                      >
                        <span>Track</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
