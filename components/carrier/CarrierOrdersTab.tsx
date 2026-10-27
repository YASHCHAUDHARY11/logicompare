"use client";

import React from "react";
import { Booking, UserProfile } from "@/types/freight";
import { UploadIcon, CheckCircleIcon, DocumentIcon } from "@/components/icons";

interface CarrierOrdersTabProps {
  currentUser: UserProfile;
  bookings: Booking[];
  statusUpdateMap: Record<string, { status: string; location: string; remarks: string; docketNo?: string; docUrl?: string; isUploading?: boolean }>;
  setStatusUpdateMap: React.Dispatch<React.SetStateAction<Record<string, { status: string; location: string; remarks: string; docketNo?: string; docUrl?: string; isUploading?: boolean }>>>;
  onUploadDocketFile: (bookingId: string, file: File) => Promise<void>;
  onUpdateShipmentStatus: (bookingId: string) => Promise<void>;
}

export function CarrierOrdersTab({
  currentUser,
  bookings,
  statusUpdateMap,
  setStatusUpdateMap,
  onUploadDocketFile,
  onUpdateShipmentStatus
}: CarrierOrdersTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Carrier Orders & Physical Docket / Bilty Entry</h2>
          <p className="text-xs text-slate-500">
            Operating as Carrier: <strong className="text-emerald-700">{currentUser.company_name}</strong>
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {bookings.map((booking) => {
          const rowForm = statusUpdateMap[booking.id] || {
            status: "",
            location: "",
            remarks: "",
            docketNo: booking.carrier_docket_no || booking.awb_number,
            docUrl: booking.carrier_docket_doc_url || "",
            isUploading: false
          };

          return (
            <div key={booking.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-3">
                  <span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-black">
                    Ref: {booking.order_id || "LC-ORDER"}
                  </span>
                  <span className="font-mono text-sm font-bold text-slate-900">
                    Docket: {booking.carrier_docket_no || booking.awb_number}
                  </span>
                  <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded capitalize font-medium">
                    {booking.mode}
                  </span>
                  <span className="text-xs font-mono text-slate-500 font-semibold">
                    {booking.origin_pin} → {booking.dest_pin}
                  </span>
                </div>

                <div className="flex items-center space-x-3 text-xs">
                  <span className="text-slate-500">Settlement:</span>
                  <span className="font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                    {booking.cost_breakdown?.payment_ref || "DIRECT-TO-PAY"}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="md:col-span-4">
                    <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Carrier Docket / LR No.</label>
                    <input
                      type="text"
                      placeholder="Enter Bilty No."
                      value={rowForm.docketNo}
                      onChange={(e) =>
                        setStatusUpdateMap({
                          ...statusUpdateMap,
                          [booking.id]: { ...rowForm, docketNo: e.target.value }
                        })
                      }
                      className="w-full bg-white border border-indigo-300 font-mono font-bold text-indigo-900 rounded-lg px-2.5 py-1.5 text-xs shadow-2xs"
                    />
                  </div>

                  <div className="md:col-span-5">
                    <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Upload Physical Bilty / POD (Image/PDF)</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="file"
                        id={`file-upload-${booking.id}`}
                        accept="image/*,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) onUploadDocketFile(booking.id, file);
                        }}
                        className="hidden"
                      />
                      <label
                        htmlFor={`file-upload-${booking.id}`}
                        className="bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition shadow-2xs flex items-center space-x-1"
                      >
                        <UploadIcon className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{rowForm.isUploading ? "Compressing & Uploading..." : "📷 Upload Bilty Scan"}</span>
                      </label>

                      {(rowForm.docUrl || booking.carrier_docket_doc_url) && (
                        <a
                          href={rowForm.docUrl || booking.carrier_docket_doc_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-700 hover:text-emerald-800 font-bold text-xs flex items-center space-x-1 underline truncate max-w-[150px]"
                        >
                          <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Attached Scan</span>
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Milestone Status</label>
                    <select
                      value={rowForm.status}
                      onChange={(e) =>
                        setStatusUpdateMap({
                          ...statusUpdateMap,
                          [booking.id]: { ...rowForm, status: e.target.value }
                        })
                      }
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                    >
                      <option value="">Update Status...</option>
                      <option value="Picked Up">Picked Up</option>
                      <option value="In Transit">In Transit</option>
                      <option value="Out for Delivery">Out for Delivery</option>
                      <option value="Delivered">Delivered</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-2 pt-1 border-t border-slate-200">
                  <input
                    type="text"
                    placeholder="Current Hub / City (e.g. Bilaspur Linehaul Gateway)"
                    value={rowForm.location}
                    onChange={(e) =>
                      setStatusUpdateMap({
                        ...statusUpdateMap,
                        [booking.id]: { ...rowForm, location: e.target.value }
                      })
                    }
                    className="w-full md:flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                  />

                  <button
                    onClick={() => onUpdateShipmentStatus(booking.id)}
                    className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2 rounded-lg transition shadow-xs flex items-center space-x-1.5 shrink-0"
                  >
                    <CheckCircleIcon className="w-4 h-4" />
                    <span>Save & Dispatch Docket Update</span>
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
