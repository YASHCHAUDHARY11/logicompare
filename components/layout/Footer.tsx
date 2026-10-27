"use client";

import React from "react";
import { TruckIcon } from "@/components/icons";
import { MERCHANT_DETAILS } from "@/lib/constants";

interface FooterProps {
  openLegalModal: (tab: "terms" | "privacy" | "refund" | "shipping" | "prohibited" | "contact") => void;
}

export function Footer({ openLegalModal }: FooterProps) {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white text-xs text-slate-600 no-print">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-b border-slate-100 pb-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                <TruckIcon className="w-4 h-4" />
              </div>
              <span className="font-extrabold text-sm text-slate-900">{MERCHANT_DETAILS.platformName}</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Operated by <strong>{MERCHANT_DETAILS.proprietor}</strong>. An enterprise B2B multi-carrier freight booking exchange and official waybill tracking network.
            </p>
            <p className="text-[11px] text-slate-500">
              Official Jurisdiction: <strong>{MERCHANT_DETAILS.jurisdiction}</strong>
            </p>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">Merchant Contact & Grievance</span>
            <p className="text-[11px]"><strong>Proprietor:</strong> {MERCHANT_DETAILS.proprietor}</p>
            <p className="text-[11px]">
              <strong>Helpline:</strong> <a href={`tel:${MERCHANT_DETAILS.phone}`} className="text-indigo-600 hover:underline">{MERCHANT_DETAILS.phone}</a>
            </p>
            <p className="text-[11px]">
              <strong>Support:</strong> <a href={`mailto:${MERCHANT_DETAILS.email}`} className="text-indigo-600 hover:underline">{MERCHANT_DETAILS.email}</a>
            </p>
            <p className="text-[11px] text-slate-500 leading-tight">
              <strong>Address:</strong> {MERCHANT_DETAILS.address}
            </p>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">Governance & Policies</span>
            <div className="grid grid-cols-2 gap-1.5 text-[11px] font-semibold text-slate-600">
              <button onClick={() => openLegalModal("terms")} className="text-left hover:text-indigo-600">Terms & Conditions</button>
              <button onClick={() => openLegalModal("privacy")} className="text-left hover:text-indigo-600">Privacy Policy</button>
              <button onClick={() => openLegalModal("refund")} className="text-left hover:text-indigo-600">Refund & Cancellation</button>
              <button onClick={() => openLegalModal("shipping")} className="text-left hover:text-indigo-600">Shipping Policy</button>
              <button onClick={() => openLegalModal("prohibited")} className="text-left hover:text-indigo-600">Prohibited Goods</button>
              <button onClick={() => openLegalModal("contact")} className="text-left hover:text-indigo-600">Contact Us</button>
            </div>
            <div className="pt-2 flex items-center space-x-2 text-[10px] text-slate-500">
              <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-mono font-bold">100% Direct Settlement</span>
              <span>•</span>
              <span>GTA 18% Compliant</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-slate-500 text-[11px]">
          <p>© 2026 {MERCHANT_DETAILS.platformName} ({MERCHANT_DETAILS.proprietor}). All rights reserved across India.</p>
          <div className="flex items-center space-x-3">
            <span>Carriage by Road Act 2007</span>
            <span>•</span>
            <span>GTA GST 18% Compliant</span>
            <span>•</span>
            <span>Refund SLA: 5–7 Business Days</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
