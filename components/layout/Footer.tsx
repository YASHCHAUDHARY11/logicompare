"use client";

import React from "react";
import { TruckIcon } from "@/components/icons";
import { MERCHANT_DETAILS } from "@/lib/constants";

interface FooterProps {
  openLegalModal: (tab: "terms" | "privacy" | "refund" | "shipping" | "prohibited" | "contact") => void;
}

export function Footer({ openLegalModal }: FooterProps) {
  return (
    <footer className="mt-auto border-t border-slate-800 bg-slate-950 text-slate-300 text-xs no-print">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 border-b border-slate-800/80 pb-8">
          <div className="space-y-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
                <TruckIcon className="w-5 h-5" />
              </div>
              <span className="font-black text-base text-white tracking-tight">{MERCHANT_DETAILS.platformName}</span>
            </div>
            <p className="text-[12px] text-slate-400 leading-relaxed">
              Proprietary freight aggregator connecting commercial shippers with verified fleets (Delhivery, Blue Dart, Safexpress, TCI, Gati) with 0% freight markups.
            </p>
            <div className="inline-flex items-center space-x-2 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-md text-[11px] text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>Jurisdiction: <strong>{MERCHANT_DETAILS.jurisdiction}</strong></span>
            </div>
          </div>

          <div className="space-y-2 bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
            <span className="text-xs font-black text-white uppercase tracking-wider block text-indigo-400">
              Merchant Contact & Grievance
            </span>
            <p className="text-[11px] text-slate-300"><strong>Proprietor:</strong> {MERCHANT_DETAILS.proprietor}</p>
            <p className="text-[11px] text-slate-300">
              <strong>Helpline:</strong> <a href={`tel:${MERCHANT_DETAILS.phone}`} className="text-indigo-400 hover:underline">{MERCHANT_DETAILS.phone}</a>
            </p>
            <p className="text-[11px] text-slate-300">
              <strong>Support:</strong> <a href={`mailto:${MERCHANT_DETAILS.email}`} className="text-indigo-400 hover:underline">{MERCHANT_DETAILS.email}</a>
            </p>
            <p className="text-[11px] text-slate-400 leading-tight">
              <strong>Address:</strong> {MERCHANT_DETAILS.address}
            </p>
          </div>

          <div className="space-y-3">
            <span className="text-xs font-black text-white uppercase tracking-wider block text-indigo-400">
              Governance & Policies
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-400">
              <button onClick={() => openLegalModal("terms")} className="text-left hover:text-white transition">Terms of Service</button>
              <button onClick={() => openLegalModal("privacy")} className="text-left hover:text-white transition">Privacy Policy</button>
              <button onClick={() => openLegalModal("refund")} className="text-left hover:text-white transition">Refund & Cancellation</button>
              <button onClick={() => openLegalModal("shipping")} className="text-left hover:text-white transition">Shipping Policy</button>
              <button onClick={() => openLegalModal("prohibited")} className="text-left hover:text-white transition">Prohibited Cargo</button>
              <button onClick={() => openLegalModal("contact")} className="text-left hover:text-white transition">Contact Us</button>
            </div>
            <div className="pt-2 flex flex-wrap gap-2 text-[10px]">
              <span className="bg-emerald-950/60 text-emerald-400 border border-emerald-800/80 px-2 py-0.5 rounded font-mono font-bold">100% Direct Settlement</span>
              <span className="bg-indigo-950/60 text-indigo-300 border border-indigo-800/80 px-2 py-0.5 rounded font-mono font-bold">GST 18% GTA</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-500 text-[11px]">
          <p>© 2026 {MERCHANT_DETAILS.platformName} ({MERCHANT_DETAILS.proprietor}). All rights reserved across India.</p>
          <div className="flex items-center space-x-3">
            <span>Carriage by Road Act 2007</span>
            <span>•</span>
            <span>Refund SLA: 5–7 Days</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
