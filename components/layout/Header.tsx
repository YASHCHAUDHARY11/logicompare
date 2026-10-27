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
    <header className="sticky top-0 z-40 bg-slate-950 text-white border-b border-slate-800 shadow-md px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Brand Identity */}
        <div 
          className="flex items-center space-x-3 cursor-pointer group select-none" 
          onClick={() => setActiveView("landing")}
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-md shadow-indigo-500/30 group-hover:scale-105 transition-transform">
            <TruckIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-black text-xl tracking-tight text-white">LogiCompare</span>
              <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Pro B2B Enterprise
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Pan-India Multi-Carrier Consignment Network</p>
          </div>
        </div>

        {/* 60FPS High-Volume Mode Toggle */}
        <div className="flex items-center space-x-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 shadow-inner">
          <span className="text-xs font-bold text-slate-300 flex items-center space-x-1">
            <BoltIcon className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>50/Day High-Volume:</span>
          </span>
          <button
            type="button"
            onClick={() => setHighVolumeMode(!highVolumeMode)}
            className={`px-3 py-1 rounded-lg text-xs font-black transition-all shadow-sm ${
              highVolumeMode
                ? "bg-emerald-500 text-slate-950 font-black shadow-emerald-500/20"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
            }`}
          >
            {highVolumeMode ? "⚡ ACTIVE (60FPS)" : "OFF"}
          </button>
        </div>

        {/* Workspace Mode Switcher */}
        <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveView("landing")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              activeView === "landing"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-300 hover:text-white"
            }`}
          >
            🏠 Home
          </button>
          <button
            type="button"
            onClick={() => setActiveView("dashboard")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              activeView === "dashboard"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-300 hover:text-white"
            }`}
          >
            🚀 Console
          </button>
        </div>

        {/* Authenticated State & Interactive Demo Selectors */}
        <div className="flex items-center space-x-2">
          {currentUser.isRealUser ? (
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="font-bold text-slate-200 truncate max-w-[130px]">
                  {currentUser.company_name || currentUser.full_name}
                </span>
                <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">
                  {currentUser.role}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 px-3 py-1.5 rounded-lg text-xs font-bold transition"
              >
                Logout
              </button>
            </div>
          ) : (
            <>
              {/* Instant One-Click Demo Mode Switchers */}
              <div className="flex items-center space-x-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => switchDemoRole("shipper")}
                  title="Switch to Shipper demo sandbox (Apex Retail)"
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                    currentUser.role === "shipper" && activeView === "dashboard"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  <span>⚡ Shipper</span>
                  <span className="text-[10px] bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-1.5 py-0.2 rounded font-bold">
                    Apex
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => switchDemoRole("vendor")}
                  title="Switch to Carrier demo sandbox (Delhivery B2B)"
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                    currentUser.role === "vendor" && activeView === "dashboard"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  <span>🚛 Carrier</span>
                  <span className="text-[10px] bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 px-1.5 py-0.2 rounded font-bold">
                    Delhivery
                  </span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs transition shadow-sm"
              >
                Login
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
