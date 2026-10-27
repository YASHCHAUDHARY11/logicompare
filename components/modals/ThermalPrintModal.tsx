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

export function ThermalPrintModal({
  printableBooking,
  batchPrintBookings,
  onClose
}: ThermalPrintModalProps) {
  const allBookings = batchPrintBookings || (printableBooking ? [printableBooking] : []);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white select-none">
      {/* 4x6 Thermal CSS Print Stylesheet */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          header, footer, nav, button, .no-print {
            display: none !important;
          }
          .thermal-page-break {
            page-break-after: always !important;
            break-after: page !important;
          }
          .thermal-label-container {
            width: 4in !important;
            height: 6in !important;
            max-height: 6in !important;
            overflow: hidden !important;
            padding: 0.2in !important;
            box-sizing: border-box !important;
            border: 3px solid black !important;
            margin: 0 auto !important;
          }
          .manifest-sheet {
            width: 100% !important;
            page-break-before: always !important;
            break-before: page !important;
          }
        }
      `}} />

      <div className="bg-white text-black rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-6 my-8 print:m-0 print:p-0 print:shadow-none print:w-full border border-slate-300">
        {/* Screen Controls (Hidden during print) */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 no-print">
          <div>
            <h3 className="text-base font-black text-slate-900">
              {batchPrintBookings
                ? `Batch 4x6 Thermal Labels (${batchPrintBookings.length} Consignments) + Handover Manifest`
                : "4x6 Thermal Multi-Box Shipping Labels"}
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Continuous thermal page layout calibrated for Zebra, TSC, Rollo, and standard 4x6 label printers
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 shadow-sm transition"
            >
              <PrinterIcon className="w-4 h-4" />
              <span>Print Continuous 4x6 Sheet</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Continuous Thermal Print Layout */}
        <div className="space-y-6 print:space-y-0">
          {allBookings.map((booking) => {
            const boxCount = booking.boxes?.length || 1;

            return (
              <React.Fragment key={booking.id}>
                {Array.from({ length: boxCount }).map((_, boxIdx) => {
                  const box = booking.boxes?.[boxIdx] || {
                    weight: booking.actual_weight,
                    length: 0,
                    width: 0,
                    height: 0
                  };

                  return (
                    <div
                      key={`${booking.id}-box-${boxIdx}`}
                      className="thermal-label-container thermal-page-break font-sans bg-white text-black border-4 border-black p-3 space-y-2.5 rounded-sm"
                    >
                      {/* Label Header */}
                      <div className="flex justify-between items-start border-b-2 border-black pb-1.5">
                        <div>
                          <h2 className="text-lg font-black leading-tight tracking-tight uppercase">
                            {booking.vendors?.name || "DELHIVERY B2B EXPRESS"}
                          </h2>
                          <span className="text-[8px] font-black uppercase tracking-widest block text-slate-700">
                            OFFICIAL CARRIER CONSIGNMENT NOTE
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-base font-black font-mono">
                            HUB-{booking.origin_pin.slice(0, 3)} / HUB-{booking.dest_pin.slice(0, 3)}
                          </span>
                          <span className="text-[9px] font-black uppercase bg-black text-white px-1.5 py-0.5 rounded-sm block mt-0.5">
                            BOX {boxIdx + 1} OF {boxCount}
                          </span>
                        </div>
                      </div>

                      {/* Barcode & Docket Identification */}
                      <div className="text-center py-1.5 border-b-2 border-black space-y-1">
                        <div className="flex justify-center items-center space-x-0.5 h-10">
                          {[2, 1, 3, 1, 4, 2, 1, 3, 2, 4, 1, 2, 3, 1, 2, 4, 1, 3, 2, 1, 3, 4, 1, 2, 3, 2, 4, 1, 2, 1, 3, 1, 4].map((w, i) => (
                            <div key={i} className="bg-black h-full" style={{ width: `${w * 2.2}px` }} />
                          ))}
                        </div>
                        <div className="flex items-center justify-center space-x-2 font-mono">
                          <span className="text-sm font-black tracking-widest">
                            DOCKET: {booking.carrier_docket_no || booking.awb_number}
                          </span>
                          <span className="text-[10px] font-bold text-slate-700">
                            [{booking.order_id}]
                          </span>
                        </div>
                      </div>

                      {/* Consignor & Consignee Details */}
                      <div className="grid grid-cols-2 gap-2 border-b-2 border-black pb-1.5 text-[10px] leading-tight">
                        <div>
                          <span className="text-[8px] font-black uppercase block text-slate-700">SHIPPER (CONSIGNOR):</span>
                          <strong className="block truncate font-black text-xs">{booking.shipper_name}</strong>
                          <p className="truncate text-slate-800">{booking.pickup_address}</p>
                          <p className="font-mono font-bold mt-0.5">PIN: {booking.origin_pin}</p>
                          <p className="font-mono text-[9px]">GSTIN: {booking.shipper_gstin}</p>
                        </div>
                        <div>
                          <span className="text-[8px] font-black uppercase block text-slate-700">DELIVER TO (CONSIGNEE):</span>
                          <strong className="block truncate font-black text-xs">{booking.consignee_name}</strong>
                          <p className="truncate text-slate-800">{booking.delivery_address}</p>
                          <p className="font-mono font-bold mt-0.5">PIN: {booking.dest_pin} • Ph: {booking.consignee_phone}</p>
                          <p className="font-mono text-[9px]">GSTIN: {booking.consignee_gstin}</p>
                        </div>
                      </div>

                      {/* Carton Spec Grid */}
                      <div className="grid grid-cols-4 gap-1 text-center border-b-2 border-black pb-1.5 text-[10px]">
                        <div>
                          <span className="text-[7px] font-bold block uppercase text-slate-700">THIS BOX WT</span>
                          <strong className="text-xs font-mono font-black">{box.weight} KG</strong>
                        </div>
                        <div>
                          <span className="text-[7px] font-bold block uppercase text-slate-700">TOTAL BILLABLE</span>
                          <strong className="text-xs font-mono font-black">{booking.billable_weight} KG</strong>
                        </div>
                        <div>
                          <span className="text-[7px] font-bold block uppercase text-slate-700">BOX DIMS</span>
                          <strong className="text-[9px] font-mono font-bold">
                            {box.length ? `${box.length}x${box.width}x${box.height}` : "STD CARGO"}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[7px] font-bold block uppercase text-slate-700">TERMS</span>
                          <strong className="text-[9px] font-mono font-black uppercase truncate block">
                            {booking.cost_breakdown?.payment_ref || "DIRECT-TO-PAY"}
                          </strong>
                        </div>
                      </div>

                      {/* Legal Sign-Off */}
                      <div className="flex justify-between items-center text-[8px] text-slate-700 pt-0.5 font-mono">
                        <span>Carriage by Road Act 2007 Verified Consignment</span>
                        <span>{new Date(booking.created_at).toLocaleDateString("en-IN")}</span>
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}

          {/* Master Pickup Handover Manifest Sheet */}
          {batchPrintBookings && (
            <div className="manifest-sheet bg-white text-black p-6 border-4 border-black font-sans space-y-5 rounded-sm">
              <div className="flex justify-between border-b-2 border-black pb-3">
                <div>
                  <h2 className="text-lg font-black tracking-tight">MASTER PICKUP HANDOVER MANIFEST</h2>
                  <p className="text-xs text-slate-700 font-medium">Shipper Dispatch Warehouse: {MERCHANT_DETAILS.defaultWarehouseAddress}</p>
                  <p className="text-xs text-slate-700 font-mono">Origin Pincode: {MERCHANT_DETAILS.defaultOriginPin}</p>
                </div>
                <div className="text-right font-mono font-bold text-xs space-y-0.5">
                  <p>DISPATCH DATE: {new Date().toLocaleDateString("en-IN")}</p>
                  <p className="text-sm font-black text-black">TOTAL CONSIGNMENTS: {batchPrintBookings.length}</p>
                  <p>
                    TOTAL WEIGHT:{" "}
                    {batchPrintBookings.reduce((acc, b) => acc + (b.billable_weight || 0), 0).toFixed(1)} KG
                  </p>
                </div>
              </div>

              <table className="w-full text-left text-[10px] border border-black">
                <thead className="bg-slate-200 border-b-2 border-black font-black uppercase">
                  <tr>
                    <th className="p-1.5 border-r border-black">#</th>
                    <th className="p-1.5 border-r border-black">Order Ref</th>
                    <th className="p-1.5 border-r border-black">Carrier Docket</th>
                    <th className="p-1.5 border-r border-black">Consignee</th>
                    <th className="p-1.5 border-r border-black">Dest PIN</th>
                    <th className="p-1.5 border-r border-black">Boxes</th>
                    <th className="p-1.5 border-r border-black">Billable (kg)</th>
                    <th className="p-1.5">Driver Sign</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black font-medium">
                  {batchPrintBookings.map((b, i) => (
                    <tr key={b.id}>
                      <td className="p-1.5 border-r border-black font-mono font-bold">{i + 1}</td>
                      <td className="p-1.5 border-r border-black font-mono font-black">{b.order_id}</td>
                      <td className="p-1.5 border-r border-black font-mono">{b.carrier_docket_no}</td>
                      <td className="p-1.5 border-r border-black truncate max-w-[130px] font-bold">{b.consignee_name}</td>
                      <td className="p-1.5 border-r border-black font-mono font-bold">{b.dest_pin}</td>
                      <td className="p-1.5 border-r border-black font-mono">{b.boxes?.length || 1}</td>
                      <td className="p-1.5 border-r border-black font-mono font-bold">{b.billable_weight}</td>
                      <td className="p-1.5"></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="grid grid-cols-2 gap-8 pt-6 border-t-2 border-black text-xs font-bold">
                <div className="space-y-1">
                  <p>Shipper Dispatch Signature: _______________________</p>
                  <p className="text-[10px] text-slate-600 font-normal">I certify that all cargo packages are sealed and handed over intact.</p>
                </div>
                <div className="space-y-1">
                  <p>Carrier Driver Handover Signature: ___________________</p>
                  <p className="text-[10px] text-slate-600 font-normal">Vehicle / Route No. & Official Linehaul Handover Timestamp</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
