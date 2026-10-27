
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
}

export function ShipmentsTab({ bookings, onRefresh, onOpenLabelModal, onOpenTrackerTab }: ShipmentsTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Consignment Manifests & Tracking Logs</h2>
          <p className="text-xs text-slate-500">Access LogiCompare Order IDs, Carrier Waybills, printable labels, and live tracking portals</p>
        </div>
        <button
          onClick={onRefresh}
          className="text-xs bg-white hover:bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 font-medium shadow-xs"
        >
          Refresh List
        </button>
      </div>

      {bookings.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-xs">
          <p className="text-slate-500 text-sm">No shipments booked yet. Calculate rates or upload bulk CSV to book your first load!</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Order Ref / Carrier Docket</th>
                <th className="py-3 px-4">Carrier</th>
                <th className="py-3 px-4">Route & PIN</th>
                <th className="py-3 px-4">Freight (Direct)</th>
                <th className="py-3 px-4">Physical Bilty</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bookings.map((booking) => {
                const carrierName = booking.vendors?.name || "Carrier Partner";
                const docketNo = booking.carrier_docket_no || booking.awb_number;
                const orderRef = booking.order_id || booking.id.slice(0, 8);
                const portalUrl = booking.carrier_portal_url || getOfficialCarrierTrackingUrl(carrierName, docketNo);

                return (
                  <tr key={booking.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-black text-indigo-700 block text-xs">{orderRef}</span>
                      <span className="font-mono text-[11px] text-slate-600 block mt-0.5">Docket: <strong>{docketNo}</strong></span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-900 block">{carrierName}</span>
                      <span className="text-[11px] text-slate-500">{booking.consignee_name}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-1 font-mono font-semibold text-slate-800">
                        <span>{booking.origin_pin}</span>
                        <span>→</span>
                        <span>{booking.dest_pin}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
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
                        <span className="text-slate-400 text-[10px]">Pending Driver Upload</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {booking.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      <a
                        href={portalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded text-[11px] font-bold inline-flex items-center space-x-1"
                      >
                        <span>Carrier Site</span>
                        <ExternalLinkIcon className="w-3 h-3" />
                      </a>
                      <button
                        onClick={() => onOpenLabelModal(booking)}
                        className="bg-white hover:bg-slate-50 text-slate-700 px-2.5 py-1 rounded text-[11px] font-semibold border border-slate-300 inline-flex items-center space-x-1"
                      >
                        <PrinterIcon className="w-3.5 h-3.5" />
                        <span>Label</span>
                      </button>
                      <button
                        onClick={() => onOpenTrackerTab(orderRef)}
                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded text-[11px] font-semibold inline-flex items-center space-x-1"
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
