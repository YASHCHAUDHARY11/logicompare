"use client";

import React from "react";
import { TruckIcon, BoltIcon } from "@/components/icons";
import { UserProfile } from "@/types/freight";

interface HeaderProps {
  activeView: "landing" | "dashboard";
  setActiveView: (view: "landing" | "dashboard") => void;
  highVolumeMode: boolean;
  setHighVolumeMode: (val: boolean) => void;
  currentUser: UserProfile;
  switchDemoRole: (role: "shipper" | "vendor") => void;
  handleLogout: () => void;
  setShowAuthModal: (val: boolean) => void;
}

export function Header({
  activeView,
  setActiveView,
  highVolumeMode,
  setHighVolumeMode,
  currentUser,
  switchDemoRole,
  handleLogout,
  setShowAuthModal
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-slate-200/80 shadow-xs px-4 lg:px-8 py-3 transition-all">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => setActiveView("landing")}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 flex items-center justify-center shadow-md shadow-indigo-600/20 group-hover:scale-105 transition-transform">
            <TruckIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-xl tracking-tight text-slate-900">LogiCompare</span>
              <span className="bg-gradient-to-r from-indigo-500/10 to-indigo-600/10 text-indigo-700 border border-indigo-200/80 text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Pro B2B Enterprise
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">Hybrid Dual-ID Consignment Network & 3D Interactive Freight</p>
          </div>
        </div>

        {/* HIGH-VOLUME MODE TOGGLE */}
        <div className="flex items-center space-x-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          <span className="text-xs font-bold text-slate-700 flex items-center space-x-1 pl-1">
            <BoltIcon className="w-4 h-4 text-amber-600" />
            <span>High-Volume 50/Day Mode:</span>
          </span>
          <button
            onClick={() => setHighVolumeMode(!highVolumeMode)}
            className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
              highVolumeMode
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-slate-200 text-slate-600 hover:bg-slate-300"
            }`}
          >
            {highVolumeMode ? "⚡ ACTIVE (60FPS Optimized)" : "OFF"}
          </button>
        </div>

        <div className="flex items-center space-x-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200 backdrop-blur-xs">
          <button
            onClick={() => setActiveView("landing")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
              activeView === "landing"
                ? "bg-white text-indigo-700 shadow-xs border border-slate-200/60"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>🏠 Home / Overview</span>
          </button>
          <button
            onClick={() => setActiveView("dashboard")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
              activeView === "dashboard"
                ? "bg-white text-indigo-700 shadow-xs border border-slate-200/60"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>🚀 Freight Matrix Dashboard</span>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          {currentUser.isRealUser ? (
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1.5 bg-slate-100/80 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="font-bold text-slate-800 truncate max-w-[140px]">{currentUser.company_name || currentUser.full_name}</span>
                <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">
                  {currentUser.role}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs"
              >
                Logout
              </button>
            </div>
          ) : (
            <>
              <div className="hidden sm:flex items-center space-x-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => switchDemoRole("shipper")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1 ${
                    currentUser.role === "shipper" && activeView === "dashboard"
                      ? "bg-white text-indigo-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span>⚡ Shipper</span>
                  <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1 py-0.2 rounded font-medium">Apex</span>
                </button>
                <button
                  onClick={() => switchDemoRole("vendor")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1 ${
                    currentUser.role === "vendor" && activeView === "dashboard"
                      ? "bg-white text-emerald-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span>⚡ Carrier</span>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1 py-0.2 rounded font-medium">Delhivery</span>
                </button>
              </div>
              <button
                onClick={() => setShowAuthModal(true)}
                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-semibold transition shadow-xs flex items-center space-x-1.5"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Account / Login</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
