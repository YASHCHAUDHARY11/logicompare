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
      {/* 1. Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-black text-slate-900">Carrier Orders & Physical Docket / Bilty Entry</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Operating as Carrier: <strong className="text-emerald-700 font-bold">{currentUser.company_name}</strong>
          </p>
        </div>
      </div>

      {/* 2. Order Dispatch Cards */}
      {bookings.length === 0 ? (
        <div className="bg-white border border-slate-300 rounded-2xl p-10 text-center text-slate-500 text-xs shadow-sm">
          No active consignments booked with your fleet network yet.
        </div>
      ) : (
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
              <div key={booking.id} className="bg-white border-2 border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                {/* Consignment Overview Strip */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-3">
                    <span className="font-mono text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded font-black">
                      Ref: {booking.order_id || "LC-ORDER"}
                    </span>
                    <span className="font-mono text-sm font-black text-slate-900">
                      Docket: {booking.carrier_docket_no || booking.awb_number}
                    </span>
                    <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold capitalize">
                      {booking.mode} Freight
                    </span>
                    <span className="text-xs font-mono text-slate-600 font-bold">
                      {booking.origin_pin} → {booking.dest_pin}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 text-xs">
                    <span className="text-slate-500 font-medium">Settlement Terms:</span>
                    <span className="font-black text-slate-800 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                      {booking.cost_breakdown?.payment_ref || "DIRECT-TO-PAY"}
                    </span>
                  </div>
                </div>

                {/* Bilty Entry & Photo Upload Form */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                    {/* Official Docket / LR Input */}
                    <div className="md:col-span-4">
                      <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1">
                        Carrier Docket / LR No.
                      </label>
                      <input
                        type="text"
                        placeholder="Enter Physical Bilty No."
                        value={rowForm.docketNo}
                        onChange={(e) =>
                          setStatusUpdateMap({
                            ...statusUpdateMap,
                            [booking.id]: { ...rowForm, docketNo: e.target.value }
                          })
                        }
                        className="w-full bg-white border-2 border-indigo-300 font-mono font-black text-indigo-950 rounded-xl px-3 py-1.5 text-xs shadow-sm focus:border-indigo-600 focus:outline-none"
                      />
                    </div>

                    {/* Compressed File Upload */}
                    <div className="md:col-span-5">
                      <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1">
                        Physical Bilty / POD (Image / PDF)
                      </label>
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
                          className="bg-white hover:bg-slate-100 text-indigo-700 border border-indigo-200 px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition shadow-xs flex items-center space-x-1.5"
                        >
                          <UploadIcon className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{rowForm.isUploading ? "Compressing & Uploading..." : "📷 Upload Bilty Scan"}</span>
                        </label>

                        {(rowForm.docUrl || booking.carrier_docket_doc_url) && (
                          <a
                            href={rowForm.docUrl || booking.carrier_docket_doc_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-700 hover:text-emerald-800 font-black text-xs flex items-center space-x-1 underline truncate max-w-[150px]"
                          >
                            <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Attached Scan</span>
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Status Dropdown */}
                    <div className="md:col-span-3">
                      <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1">
                        Transit Milestone Status
                      </label>
                      <select
                        value={rowForm.status}
                        onChange={(e) =>
                          setStatusUpdateMap({
                            ...statusUpdateMap,
                            [booking.id]: { ...rowForm, status: e.target.value }
                          })
                        }
                        className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-bold focus:border-indigo-600 focus:outline-none"
                      >
                        <option value="">Update Status...</option>
                        <option value="Picked Up">Picked Up</option>
                        <option value="In Transit">In Transit</option>
                        <option value="Out for Delivery">Out for Delivery</option>
                        <option value="Delivered">Delivered</option>
                      </select>
                    </div>
                  </div>

                  {/* Location & Save Action Bar */}
                  <div className="flex flex-col md:flex-row items-center gap-2.5 pt-2 border-t border-slate-200">
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
                      className="w-full md:flex-1 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-medium focus:border-indigo-600 focus:outline-none"
                    />

                    <button
                      type="button"
                      onClick={() => onUpdateShipmentStatus(booking.id)}
                      className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-2 rounded-xl transition shadow-sm flex items-center justify-center space-x-1.5 shrink-0"
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
      )}
    </div>
  );
}
