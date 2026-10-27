"use client";

import React from "react";
import { Booking } from "@/types/freight";
import { MERCHANT_DETAILS } from "@/lib/constants";
import { PrinterIcon, XMarkIcon } from "@/components/icons";

interface ThermalPrintModalProps {
  printableBooking: Booking | null;
  batchPrintBookings: Booking[] | null;
  onClose: () => void;
}

export function ThermalPrintModal({ printableBooking, batchPrintBookings, onClose }: ThermalPrintModalProps) {
  const allBookings = batchPrintBookings || (printableBooking ? [printableBooking] : []);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white">
      <div className="bg-white text-black rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6 my-8 print:m-0 print:p-0 print:shadow-none print:w-full">
        <div className="flex items-center justify-between border-b pb-3 no-print">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {batchPrintBookings
                ? `Batch 4x6 Thermal Labels (${batchPrintBookings.length} Consignments) + Handover Manifest`
                : "4x6 Thermal Multi-Box Labels"}
            </h3>
            <p className="text-[11px] text-slate-500">Ready for Zebra, TSC, and Rollo 4x6 thermal label printers</p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => window.print()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-1.5 rounded-lg text-xs flex items-center space-x-1.5 shadow-sm"
            >
              <PrinterIcon className="w-4 h-4" />
              <span>Print Continuous 4x6 Sheet</span>
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="space-y-6 print:space-y-0">
          {allBookings.map((booking) => {
            const boxCount = booking.boxes?.length || 1;
            return (
              <React.Fragment key={booking.id}>
                {Array.from({ length: boxCount }).map((_, boxIdx) => {
                  const box = booking.boxes?.[boxIdx] || { weight: booking.actual_weight, length: 0, width: 0, height: 0 };
                  return (
                    <div
                      key={`${booking.id}-box-${boxIdx}`}
                      className="thermal-label-container thermal-page-break font-sans bg-white text-black border-4 border-black p-3 space-y-2"
                    >
                      <div className="flex justify-between items-start border-b-2 border-black pb-1.5">
                        <div>
                          <h2 className="text-lg font-black leading-tight">{booking.vendors?.name || "DELHIVERY B2B EXPRESS"}</h2>
                          <span className="text-[8px] font-bold uppercase tracking-widest block">OFFICIAL CARRIER CONSIGNMENT NOTE</span>
                        </div>
                        <div className="text-right">
                          <span className="text-base font-black font-mono">
                            HUB-{booking.origin_pin.slice(0, 3)} / HUB-{booking.dest_pin.slice(0, 3)}
                          </span>
                          <span className="text-[9px] font-black uppercase bg-black text-white px-1 py-0.2 rounded block mt-0.5">
                            BOX {boxIdx + 1} OF {boxCount}
                          </span>
                        </div>
                      </div>

                      <div className="text-center py-1 border-b-2 border-black space-y-0.5">
                        <div className="flex justify-center items-center space-x-0.5 h-10">
                          {[2, 1, 3, 1, 4, 2, 1, 3, 2, 4, 1, 2, 3, 1, 2, 4, 1, 3, 2, 1, 3, 4, 1, 2, 3, 2, 4, 1, 2, 1, 3, 1, 4].map((w, i) => (
                            <div key={i} className="bg-black h-full" style={{ width: `${w * 2.2}px` }} />
                          ))}
                        </div>
                        <div className="flex items-center justify-center space-x-2 font-mono">
                          <span className="text-sm font-black tracking-widest">
                            DOCKET: {booking.carrier_docket_no || booking.awb_number}
                          </span>
                          <span className="text-[10px] font-bold">[{booking.order_id}]</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 border-b-2 border-black pb-1 text-[10px] leading-tight">
                        <div>
                          <span className="text-[8px] font-black uppercase block text-slate-700">SHIPPER (CONSIGNOR):</span>
                          <strong className="block truncate">{booking.shipper_name}</strong>
                          <p className="truncate">{booking.pickup_address}</p>
                          <p className="font-mono font-bold">PIN: {booking.origin_pin}</p>
                        </div>
                        <div>
                          <span className="text-[8px] font-black uppercase block text-slate-700">DELIVER TO (CONSIGNEE):</span>
                          <strong className="block truncate">{booking.consignee_name}</strong>
                          <p className="truncate">{booking.delivery_address}</p>
                          <p className="font-mono font-bold">PIN: {booking.dest_pin} • Ph: {booking.consignee_phone}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-1 text-center border-b-2 border-black pb-1 text-[10px]">
                        <div>
                          <span className="text-[7px] font-bold block uppercase">THIS BOX WT</span>
                          <strong className="text-xs font-mono">{box.weight} KG</strong>
                        </div>
                        <div>
                          <span className="text-[7px] font-bold block uppercase">TOTAL CONSIGNMENT</span>
                          <strong className="text-xs font-mono">{booking.billable_weight} KG</strong>
                        </div>
                        <div>
                          <span className="text-[7px] font-bold block uppercase">BOX DIMS</span>
                          <strong className="text-[9px] font-mono">{box.length ? `${box.length}x${box.width}x${box.height}` : "STD CARGO"}</strong>
                        </div>
                        <div>
                          <span className="text-[7px] font-bold block uppercase">SETTLEMENT</span>
                          <strong className="text-[9px] font-mono uppercase">{booking.cost_breakdown?.payment_ref || "DIRECT-TO-PAY"}</strong>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-[8px] text-slate-700 pt-0.5 font-mono">
                        <span>Carriage by Road Act 2007 Compliant</span>
                        <span>{new Date(booking.created_at).toLocaleDateString("en-IN")}</span>
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}

          {batchPrintBookings && (
            <div className="manifest-sheet bg-white text-black p-4 border-2 border-black font-sans space-y-4">
              <div className="flex justify-between border-b-2 border-black pb-2">
                <div>
                  <h2 className="text-base font-black">MASTER PICKUP HANDOVER MANIFEST</h2>
                  <p className="text-xs">Shipper Warehouse: {MERCHANT_DETAILS.defaultWarehouseAddress}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold font-mono">DATE: {new Date().toLocaleDateString("en-IN")}</span>
                  <p className="text-xs font-bold">TOTAL DISPATCHES: {batchPrintBookings.length} Consignments</p>
                </div>
              </div>

              <table className="w-full text-left text-[10px] border border-black">
                <thead className="bg-slate-200 border-b border-black font-bold">
                  <tr>
                    <th className="p-1 border-r border-black">#</th>
                    <th className="p-1 border-r border-black">Order Ref</th>
                    <th className="p-1 border-r border-black">Carrier Docket</th>
                    <th className="p-1 border-r border-black">Consignee</th>
                    <th className="p-1 border-r border-black">Dest PIN</th>
                    <th className="p-1 border-r border-black">Boxes</th>
                    <th className="p-1 border-r border-black">Weight (kg)</th>
                    <th className="p-1">Handover Sign</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black">
                  {batchPrintBookings.map((bk, i) => (
                    <tr key={bk.id}>
                      <td className="p-1 border-r border-black font-mono">{i + 1}</td>
                      <td className="p-1 border-r border-black font-mono font-bold">{bk.order_id}</td>
                      <td className="p-1 border-r border-black font-mono">{bk.carrier_docket_no}</td>
                      <td className="p-1 border-r border-black truncate max-w-[120px]">{bk.consignee_name}</td>
                      <td className="p-1 border-r border-black font-mono">{bk.dest_pin}</td>
                      <td className="p-1 border-r border-black font-mono">{bk.boxes?.length || 1}</td>
                      <td className="p-1 border-r border-black font-mono">{bk.billable_weight}</td>
                      <td className="p-1"></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="grid grid-cols-2 gap-8 pt-6 border-t-2 border-black text-xs">
                <div>
                  <p className="font-bold">Shipper Dispatch Signature: _______________________</p>
                  <p className="text-[10px] text-slate-600 mt-1">Verified package count & seal status</p>
                </div>
                <div>
                  <p className="font-bold">Driver / Linehaul Executive Sign: ___________________</p>
                  <p className="text-[10px] text-slate-600 mt-1">Vehicle / Route No. & Official Handover Timestamp</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
