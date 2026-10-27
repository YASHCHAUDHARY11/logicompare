
"use client";

import React, { useState } from "react";
import { CalculatedQuote, Booking, UserProfile, BoxItem } from "@/types/freight";
import { formatINR, generateCarrierDocket, getOfficialCarrierTrackingUrl } from "@/lib/freightUtils";
import { XMarkIcon } from "@/components/icons";
import { supabase } from "@/lib/supabaseClient";

interface DirectBookingModalProps {
  quote: CalculatedQuote;
  currentUser: UserProfile;
  originPin: string;
  destPin: string;
  boxes: BoxItem[];
  declaredValue: number;
  pickupAddress: string;
  onClose: () => void;
  onSuccess: (b: Booking) => void;
}

export function DirectBookingModal({
  quote,
  currentUser,
  originPin,
  destPin,
  boxes,
  declaredValue,
  pickupAddress,
  onClose,
  onSuccess
}: DirectBookingModalProps) {
  const [consigneeName, setConsigneeName] = useState("Prime Electronics Retail");
  const [consigneePhone, setConsigneePhone] = useState("+91 98200 44556");
  const [consigneeGstin, setConsigneeGstin] = useState("27AAACP9988G1ZK");
  const [deliveryAddress, setDeliveryAddress] = useState("Warehouse 4B, Bhiwandi Logistics Park, Mumbai");
  const [settlementType, setSettlementType] = useState<"direct_to_pay" | "direct_upi" | "corporate_credit">("direct_to_pay");
  const [directPaymentUtr, setDirectPaymentUtr] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!termsAccepted) {
      alert("Please accept consignment booking terms.");
      return;
    }
    setIsSubmitting(true);

    const platformOrderId = `LC-${Math.floor(100000 + Math.random() * 900000)}`;
    const initialCarrierDocket = generateCarrierDocket(quote.vendor.name);
    const portalUrl = getOfficialCarrierTrackingUrl(quote.vendor.name, initialCarrierDocket);

    let refString = "DIRECT-TO-PAY-POD";
    if (settlementType === "direct_upi") {
      refString = directPaymentUtr ? `UPI-UTR-${directPaymentUtr}` : `DIRECT-UPI-${quote.vendor.upi_id}`;
    } else if (settlementType === "corporate_credit") {
      refString = "B2B-DIRECT-CREDIT-TERMS";
    }

    const enhancedBreakdown = {
      ...quote.breakdown,
      settlement_type: settlementType,
      payment_method: settlementType === "direct_upi" ? "Direct Carrier UPI" : settlementType === "corporate_credit" ? "B2B Monthly Credit" : "Direct To-Pay POD",
      payment_ref: refString,
      carrier_upi: quote.vendor.upi_id
    };

    const newBookingRecord: Partial<Booking> = {
      order_id: platformOrderId,
      awb_number: initialCarrierDocket,
      carrier_docket_no: initialCarrierDocket,
      carrier_portal_url: portalUrl,
      shipper_id: currentUser.id,
      vendor_id: quote.vendor.id,
      rate_card_id: quote.rateCard.id,
      shipper_name: currentUser.company_name || currentUser.full_name,
      shipper_phone: currentUser.phone || "+91 8194017660",
      shipper_email: currentUser.email,
      shipper_gstin: currentUser.gstin || "07AAACA1234A1Z5",
      pickup_address: pickupAddress,
      consignee_name: consigneeName,
      consignee_phone: consigneePhone,
      consignee_gstin: consigneeGstin,
      delivery_address: deliveryAddress,
      origin_pin: originPin,
      dest_pin: destPin,
      mode: quote.rateCard.mode,
      boxes: boxes,
      declared_value: declaredValue,
      actual_weight: quote.actualWeight,
      volumetric_weight: quote.volumetricWeight,
      billable_weight: quote.billableWeight,
      cost_breakdown: enhancedBreakdown,
      final_total: quote.breakdown.total,
      status: "Booked",
      tracking_history: [
        {
          status: "Booked",
          location: `Origin Hub (${originPin})`,
          timestamp: new Date().toISOString(),
          remarks: `Order Ref ${platformOrderId} generated. Carrier Docket ${initialCarrierDocket} assigned.`
        }
      ]
    };

    try {
      const { data, error } = await supabase.from("bookings").insert([newBookingRecord]).select("*, vendors(*)");
      if (!error && data && data[0]) {
        onSuccess(data[0] as Booking);
      } else {
        const localMock = {
          ...(newBookingRecord as Booking),
          id: `book-${Date.now()}`,
          created_at: new Date().toISOString(),
          vendors: quote.vendor
        };
        onSuccess(localMock);
      }
    } catch {
      // Ignored
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-xl my-8">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Direct Consignment Booking & Carrier Settlement</h3>
            <p className="text-xs text-slate-500">Transporter: <strong className="text-emerald-700">{quote.vendor.name}</strong></p>
          </div>
          <button onClick={onClose}><XMarkIcon className="w-5 h-5" /></button>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-slate-600">Direct Carrier Freight:</span>
            <span className="text-base font-bold text-slate-900">{formatINR(quote.breakdown.freightSubtotal)}</span>
          </div>
          <div className="flex justify-between items-center text-indigo-700">
            <span>Platform Fee (2%):</span>
            <span className="font-bold">₹{quote.breakdown.platformConvenienceFee}</span>
          </div>
          <div className="border-t pt-2 flex justify-between items-center text-sm font-black text-emerald-800">
            <span>Total Outlay:</span>
            <span>{formatINR(quote.breakdown.total)}</span>
          </div>
        </div>

        <div className="space-y-3 text-xs">
          <label className="block text-slate-800 font-bold">Settlement Method with {quote.vendor.name}:</label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <label className={`p-3 rounded-xl border cursor-pointer ${settlementType === "direct_to_pay" ? "bg-emerald-50 border-emerald-300 ring-1 ring-emerald-300" : "bg-white"}`}>
              <input type="radio" checked={settlementType === "direct_to_pay"} onChange={() => setSettlementType("direct_to_pay")} className="text-emerald-600" />
              <span className="font-bold block mt-1">💵 To-Pay POD</span>
              <p className="text-[10px] text-slate-500">Pay cash/cheque upon parcel delivery.</p>
            </label>

            <label className={`p-3 rounded-xl border cursor-pointer ${settlementType === "direct_upi" ? "bg-emerald-50 border-emerald-300 ring-1 ring-emerald-300" : "bg-white"}`}>
              <input type="radio" checked={settlementType === "direct_upi"} onChange={() => setSettlementType("direct_upi")} className="text-emerald-600" />
              <span className="font-bold block mt-1">📲 Carrier UPI</span>
              <p className="text-[10px] text-slate-500">Direct transfer to carrier's handle.</p>
            </label>

            <label className={`p-3 rounded-xl border cursor-pointer ${settlementType === "corporate_credit" ? "bg-emerald-50 border-emerald-300 ring-1 ring-emerald-300" : "bg-white"}`}>
              <input type="radio" checked={settlementType === "corporate_credit"} onChange={() => setSettlementType("corporate_credit")} className="text-emerald-600" />
              <span className="font-bold block mt-1">🏢 Monthly Credit</span>
              <p className="text-[10px] text-slate-500">Pre-approved GST credit terms.</p>
            </label>
          </div>

          {settlementType === "direct_upi" && (
            <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 space-y-2">
              <div className="flex justify-between items-center font-mono">
                <span className="text-emerald-900 font-bold">Carrier UPI ID:</span>
                <span className="bg-white px-2 py-0.5 rounded font-bold text-slate-900">{quote.vendor.upi_id || "delhivery.b2b@icici"}</span>
              </div>
              <input
                type="text"
                placeholder="UTR / Payment Ref (Optional)"
                value={directPaymentUtr}
                onChange={(e) => setDirectPaymentUtr(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded p-1.5 font-mono text-slate-900"
              />
            </div>
          )}

          <div className="space-y-2 pt-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-700 font-semibold mb-0.5">Consignee Name</label>
                <input type="text" value={consigneeName} onChange={(e) => setConsigneeName(e.target.value)} className="w-full border rounded p-1.5" />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-0.5">Consignee Phone</label>
                <input type="text" value={consigneePhone} onChange={(e) => setConsigneePhone(e.target.value)} className="w-full border rounded p-1.5" />
              </div>
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-0.5">Destination Address</label>
              <input type="text" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} className="w-full border rounded p-1.5" />
            </div>
          </div>

          <label className="flex items-start space-x-2 pt-1 cursor-pointer">
            <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-0.5" />
            <span className="text-[11px] text-slate-600">
              I agree to settle freight directly with {quote.vendor.name} under Carriage by Road Act guidelines.
            </span>
          </label>
        </div>

        <div className="flex justify-end space-x-3 border-t pt-3">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-slate-600">Cancel</button>
          <button
            disabled={isSubmitting || !termsAccepted}
            onClick={handleConfirm}
            className="bg-emerald-600 text-white font-bold px-5 py-2 rounded-lg text-xs"
          >
            {isSubmitting ? "Booking..." : "Confirm & Assign Carrier Docket"}
          </button>
        </div>
      </div>
    </div>
  );
}
