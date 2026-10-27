
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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full p-6 shadow-2xl my-8 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Legal, Governance & Razorpay KYC Compliance</h3>
            <p className="text-xs text-slate-500">Merchant: {MERCHANT_DETAILS.proprietor} • Jurisdiction: {MERCHANT_DETAILS.jurisdiction}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 border-b border-slate-100 pb-2">
          {[
            { id: "terms", label: "Terms & Conditions" },
            { id: "privacy", label: "Privacy Policy" },
            { id: "refund", label: "Refund & Cancellation" },
            { id: "shipping", label: "Shipping & Delivery" },
            { id: "prohibited", label: "Prohibited Goods" },
            { id: "contact", label: "Contact Us" }
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                tab === t.id ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-600 space-y-3 max-h-96 overflow-y-auto pr-2 leading-relaxed">
          {tab === "terms" && (
            <div className="space-y-2.5">
              <h4 className="font-bold text-slate-900 text-sm">Terms and Conditions of Service</h4>
              <p>
                <strong>1. Platform Nature:</strong> {MERCHANT_DETAILS.platformName} is a proprietary B2B freight aggregator platform operated by <strong>{MERCHANT_DETAILS.proprietor}</strong>.
              </p>
              <p>
                <strong>2. Statutory Compliance & E-Way Bills:</strong> Shippers warrant that consignments exceeding ₹50,000 are accompanied by valid GST E-Way Bills.
              </p>
              <p>
                <strong>3. Governing Law:</strong> Exclusive jurisdiction of competent courts in <strong>{MERCHANT_DETAILS.jurisdiction}</strong>.
              </p>
            </div>
          )}

          {tab === "privacy" && (
            <div className="space-y-2.5">
              <h4 className="font-bold text-slate-900 text-sm">Privacy & Data Protection Policy</h4>
              <p>
                <strong>Grievance Officer:</strong> {MERCHANT_DETAILS.proprietor} ({MERCHANT_DETAILS.email}) • Address: {MERCHANT_DETAILS.address}
              </p>
            </div>
          )}

          {tab === "refund" && (
            <div className="space-y-2.5">
              <h4 className="font-bold text-slate-900 text-sm">Refund & Cancellation Policy</h4>
              <p>
                Shipments cancelled prior to pickup qualify for a <strong>100% full refund</strong> of platform verification fees within <strong>5 to 7 business days</strong>.
              </p>
            </div>
          )}

          {tab === "shipping" && (
            <div className="space-y-2.5">
              <h4 className="font-bold text-slate-900 text-sm">Shipping, Transit SLAs & Delivery Policy</h4>
              <p>
                Surface Express SLAs: 3–6 business days. Air Express Cargo: 24–48 hours connecting major airport hubs.
              </p>
            </div>
          )}

          {tab === "prohibited" && (
            <div className="space-y-2.5">
              <h4 className="font-bold text-slate-900 text-sm">Strictly Prohibited & Banned Cargo</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>Explosives, fireworks, ammunition, hazardous chemicals (Classes 1–9).</li>
                <li>Flammable liquids, gases, compressed cylinders, unregistered bullion, currency.</li>
              </ul>
            </div>
          )}

          {tab === "contact" && (
            <div className="space-y-2.5">
              <h4 className="font-bold text-slate-900 text-sm">Official Merchant Contact</h4>
              <p>Proprietor: {MERCHANT_DETAILS.proprietor}</p>
              <p>Phone: {MERCHANT_DETAILS.phone} • Email: {MERCHANT_DETAILS.email}</p>
              <p>Address: {MERCHANT_DETAILS.address}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end border-t pt-3">
          <button onClick={onClose} className="bg-slate-900 text-white font-bold text-xs px-4 py-2 rounded-lg">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
