"use client";

import React from "react";
import { MERCHANT_DETAILS } from "@/lib/constants";
import { XMarkIcon } from "@/components/icons";

interface LegalModalProps {
  tab: "terms" | "privacy" | "refund" | "shipping" | "prohibited" | "contact";
  setTab: (t: "terms" | "privacy" | "refund" | "shipping" | "prohibited" | "contact") => void;
  onClose: () => void;
}

export function LegalModal({ tab, setTab, onClose }: LegalModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto select-none">
      <div className="bg-white border border-slate-300 rounded-3xl max-w-3xl w-full p-6 shadow-2xl my-8 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-black text-slate-900">Legal, Governance & Razorpay KYC Compliance</h3>
            <p className="text-xs text-slate-500 font-medium">
              Merchant: {MERCHANT_DETAILS.proprietor} • Jurisdiction: {MERCHANT_DETAILS.jurisdiction}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tab Bar */}
        <div className="flex flex-wrap gap-1.5 border-b border-slate-100 pb-2">
          {[
            { id: "terms", label: "Terms of Service" },
            { id: "privacy", label: "Privacy Policy" },
            { id: "refund", label: "Refund & Cancellation" },
            { id: "shipping", label: "Shipping Policy" },
            { id: "prohibited", label: "Prohibited Goods" },
            { id: "contact", label: "Contact Us" }
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                tab === t.id ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content Body */}
        <div className="text-xs text-slate-600 space-y-3 max-h-96 overflow-y-auto pr-2 leading-relaxed">
          {tab === "terms" && (
            <div className="space-y-2.5">
              <h4 className="font-black text-slate-900 text-sm">Terms and Conditions of Service</h4>
              <p>
                <strong>1. Platform Nature:</strong> {MERCHANT_DETAILS.platformName} is a proprietary B2B freight aggregator platform operated by <strong>{MERCHANT_DETAILS.proprietor}</strong>. LogiCompare connects commercial shippers with third-party verified fleet operators (Delhivery, Blue Dart, TCI, Safexpress, Gati).
              </p>
              <p>
                <strong>2. Statutory Compliance & E-Way Bills:</strong> Shippers warrant that consignments exceeding ₹50,000 are accompanied by valid, active GST E-Way Bills and commercial invoices.
              </p>
              <p>
                <strong>3. Governing Law:</strong> These terms are governed by the laws of India. Any dispute shall be subject to the exclusive jurisdiction of the competent courts in <strong>{MERCHANT_DETAILS.jurisdiction}</strong>.
              </p>
            </div>
          )}

          {tab === "privacy" && (
            <div className="space-y-2.5">
              <h4 className="font-black text-slate-900 text-sm">Privacy & Data Protection Policy</h4>
              <p>
                <strong>1. Collection of Business Data:</strong> We collect business contact details, GSTIN identifiers, pickup/delivery warehouse addresses, and package specifications solely to facilitate freight calculations, AWB barcode printing, and linehaul tracking.
              </p>
              <p>
                <strong>2. Designated Grievance Officer:</strong> In compliance with the Information Technology Act, 2000 and Digital Personal Data Protection Act, the designated Grievance Officer is:
              </p>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-800 space-y-0.5">
                <p><strong>Officer:</strong> {MERCHANT_DETAILS.proprietor}</p>
                <p><strong>Email:</strong> {MERCHANT_DETAILS.email}</p>
                <p><strong>Helpline:</strong> {MERCHANT_DETAILS.phone}</p>
                <p><strong>Address:</strong> {MERCHANT_DETAILS.address}</p>
              </div>
            </div>
          )}

          {tab === "refund" && (
            <div className="space-y-2.5">
              <h4 className="font-black text-slate-900 text-sm">Refund & Cancellation Policy</h4>
              <p>
                <strong>1. Cancellation Prior to Pickup:</strong> Consignments cancelled before carrier pickup attempt qualify for a <strong>100% full refund</strong> of platform verification fees.
              </p>
              <p>
                <strong>2. Refund Settlement Timeframe:</strong> All approved refunds are processed back to the original source account via Razorpay. The standard credit window is <strong>5 to 7 business days</strong>.
              </p>
            </div>
          )}

          {tab === "shipping" && (
            <div className="space-y-2.5">
              <h4 className="font-black text-slate-900 text-sm">Shipping, Transit SLAs & Delivery Policy</h4>
              <p>
                <strong>1. Serviceable Network:</strong> LogiCompare Pro services 19,000+ PIN codes across India via aggregated multi-modal express networks.
              </p>
              <p>
                <strong>2. Estimated Transit SLAs:</strong> Surface Express (3–6 business days), Air Express Cargo (24–48 hours connecting primary metro airport gateways).
              </p>
            </div>
          )}

          {tab === "prohibited" && (
            <div className="space-y-2.5">
              <h4 className="font-black text-slate-900 text-sm">Strictly Prohibited & Banned Cargo</h4>
              <ul className="list-disc pl-5 space-y-1 text-slate-700">
                <li>Explosives, fireworks, ammunition, and hazardous chemicals (Classes 1–9 Hazmat).</li>
                <li>Flammable liquids, gases, compressed cylinders, and corrosives.</li>
                <li>Unregistered bullion, loose precious gems, and sovereign cash/currency notes.</li>
                <li>Narcotics and contraband goods prohibited under the NDPS Act.</li>
              </ul>
            </div>
          )}

          {tab === "contact" && (
            <div className="space-y-3">
              <h4 className="font-black text-slate-900 text-sm">Official Merchant Contact & Support</h4>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5 font-medium">
                <p><strong className="text-slate-900">Proprietor / Merchant:</strong> {MERCHANT_DETAILS.proprietor}</p>
                <p><strong className="text-slate-900">Platform:</strong> {MERCHANT_DETAILS.platformName} ({MERCHANT_DETAILS.category})</p>
                <p><strong className="text-slate-900">Email:</strong> <a href={`mailto:${MERCHANT_DETAILS.email}`} className="text-indigo-600 underline">{MERCHANT_DETAILS.email}</a></p>
                <p><strong className="text-slate-900">Helpline:</strong> <a href={`tel:${MERCHANT_DETAILS.phone}`} className="text-indigo-600 underline">{MERCHANT_DETAILS.phone}</a></p>
                <p><strong className="text-slate-900">Operating Address:</strong> {MERCHANT_DETAILS.address}</p>
                <p><strong className="text-slate-900">Operating Hours:</strong> {MERCHANT_DETAILS.operatingHours}</p>
                <p><strong className="text-slate-900">Jurisdiction:</strong> {MERCHANT_DETAILS.jurisdiction}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-200 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs px-5 py-2 rounded-xl transition"
          >
            Close Compliance Window
          </button>
        </div>
      </div>
    </div>
  );
}
