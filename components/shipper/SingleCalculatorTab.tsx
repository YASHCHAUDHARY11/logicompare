
"use client";

import React, { useMemo } from "react";
import { BoxItem, CalculatedQuote, PinLookupResult } from "@/types/freight";
import { BoxIcon, MapPinIcon, PlusIcon, TrashIcon, SearchIcon, PlaneIcon, TruckIcon, ArrowRightIcon } from "@/components/icons";
import { RouteTrajectory3D } from "@/components/visuals/RouteTrajectory3D";
import { Interactive3DBox } from "@/components/visuals/Interactive3DBox";
import { formatINR } from "@/lib/freightUtils";

interface SingleCalculatorTabProps {
  highVolumeMode: boolean;
  originPin: string;
  setOriginPin: (val: string) => void;
  destPin: string;
  setDestPin: (val: string) => void;
  declaredValue: number;
  setDeclaredValue: (val: number) => void;
  selectedMode: "all" | "surface" | "air" | "ftl";
  setSelectedMode: (val: "all" | "surface" | "air" | "ftl") => void;
  isOda: boolean;
  setIsOda: (val: boolean) => void;
  boxes: BoxItem[];
  setBoxes: React.Dispatch<React.SetStateAction<BoxItem[]>>;
  selectedBoxFor3D: number;
  setSelectedBoxFor3D: (idx: number) => void;
  originZoneData: PinLookupResult;
  destZoneData: PinLookupResult;
  calculatedQuotes: CalculatedQuote[];
  onOpenCityModal: (target: "origin" | "dest") => void;
  onSelectQuoteForBooking: (q: CalculatedQuote) => void;
}

export function SingleCalculatorTab({
  highVolumeMode,
  originPin,
  setOriginPin,
  destPin,
  setDestPin,
  declaredValue,
  setDeclaredValue,
  selectedMode,
  setSelectedMode,
  isOda,
  setIsOda,
  boxes,
  setBoxes,
  selectedBoxFor3D,
  setSelectedBoxFor3D,
  originZoneData,
  destZoneData,
  calculatedQuotes,
  onOpenCityModal,
  onSelectQuoteForBooking
}: SingleCalculatorTabProps) {
  const totalActualWeight = useMemo(() => {
    return boxes.reduce((acc, b) => acc + (Number(b.weight) || 0) * (Number(b.qty) || 1), 0);
  }, [boxes]);

  const totalVolumetricWeight = useMemo(() => {
    const divisor = selectedMode === "air" ? 5000 : 4500;
    return boxes.reduce((acc, b) => {
      const volKg = ((Number(b.length) || 0) * (Number(b.width) || 0) * (Number(b.height) || 0)) / divisor;
      return acc + volKg * (Number(b.qty) || 1);
    }, 0);
  }, [boxes, selectedMode]);

  const billableWeight = useMemo(() => {
    return Math.max(totalActualWeight, Math.round(totalVolumetricWeight * 100) / 100);
  }, [totalActualWeight, totalVolumetricWeight]);

  const addBox = () => {
    setBoxes([...boxes, { id: `box-${Date.now()}`, qty: 1, weight: 10, length: 30, width: 30, height: 30 }]);
  };

  const removeBox = (id: string) => {
    if (boxes.length <= 1) return;
    setBoxes(boxes.filter((b) => b.id !== id));
  };

  const updateBox = (id: string, field: keyof BoxItem, value: number) => {
    setBoxes(boxes.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  };

  const currentBox3D = boxes[selectedBoxFor3D] || boxes[0];

  return (
    <div className="space-y-6">
      <div className="bg-white/90 backdrop-blur-md border border-slate-200/80 rounded-2xl p-6 shadow-xl shadow-slate-200/50">
        <div className="border-b border-slate-100 pb-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
              <BoxIcon className="w-5 h-5 text-indigo-600" />
              <span>Pan-India Commercial Freight Calculator</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Direct transporter tariffs with 0% freight markup. Platform fee is 2% (min ₹25) on booking.
            </p>
          </div>
          <span className="bg-emerald-50 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200 w-fit">
            Direct Carrier Settlement
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-600">Origin PIN (Pickup)</label>
              <button
                type="button"
                onClick={() => onOpenCityModal("origin")}
                className="text-[11px] text-indigo-600 hover:underline font-semibold flex items-center space-x-1"
              >
                <MapPinIcon className="w-3 h-3" />
                <span>City Search</span>
              </button>
            </div>
            <input
              type="text"
              maxLength={6}
              value={originPin}
              disabled={highVolumeMode}
              onChange={(e) => setOriginPin(e.target.value)}
              className={`w-full border rounded-lg px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none ${
                highVolumeMode ? "bg-slate-200 cursor-not-allowed border-slate-300" : "bg-white border-slate-300"
              }`}
            />
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="text-indigo-700 font-semibold truncate">
                {originZoneData.loading ? "Looking up..." : `📍 ${originZoneData.city}, ${originZoneData.state}`}
              </span>
              <span className="bg-slate-200/80 px-2 py-0.5 rounded text-slate-700 font-mono text-[10px] shrink-0">
                {originZoneData.hub}
              </span>
            </div>
          </div>

          <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-600">Destination PIN (Drop)</label>
              <button
                type="button"
                onClick={() => onOpenCityModal("dest")}
                className="text-[11px] text-emerald-600 hover:underline font-semibold flex items-center space-x-1"
              >
                <MapPinIcon className="w-3 h-3" />
                <span>City Search</span>
              </button>
            </div>
            <input
              type="text"
              maxLength={6}
              value={destPin}
              onChange={(e) => setDestPin(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none"
            />
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="text-emerald-700 font-semibold truncate">
                {destZoneData.loading ? "Looking up..." : `📍 ${destZoneData.city}, ${destZoneData.state}`}
              </span>
              <span className="bg-slate-200/80 px-2 py-0.5 rounded text-slate-700 font-mono text-[10px] shrink-0">
                {destZoneData.hub}
              </span>
            </div>
          </div>

          <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Declared Value (₹) for FOV</label>
            <input
              type="number"
              value={declaredValue}
              onChange={(e) => setDeclaredValue(Number(e.target.value))}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none"
            />
            <p className="text-[11px] text-slate-500 mt-2">FOV covers 0.2% transit risk loss</p>
          </div>

          <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 flex flex-col justify-between">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Transport Mode</label>
              <select
                value={selectedMode}
                onChange={(e) => setSelectedMode(e.target.value as any)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none"
              >
                <option value="all">All Modes</option>
                <option value="surface">Surface Express Only</option>
                <option value="air">Air Cargo Only</option>
                <option value="ftl">Full Truck Load (FTL)</option>
              </select>
            </div>

            <label className="flex items-center space-x-2 mt-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={isOda}
                onChange={(e) => setIsOda(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 border-slate-300"
              />
              <span className="text-xs text-slate-700 font-medium">ODA Pincode (+₹450)</span>
            </label>
          </div>
        </div>

        {!highVolumeMode && (
          <div className="mb-6">
            <RouteTrajectory3D originHub={originZoneData.hub} destHub={destZoneData.hub} />
          </div>
        )}

        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Consignment Box Dimensions ({boxes.length} types)
            </span>
            <button
              type="button"
              onClick={addBox}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center space-x-1"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              <span>Add Another Box Type</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            <div className={highVolumeMode ? "lg:col-span-12 space-y-2" : "lg:col-span-8 space-y-2"}>
              {boxes.map((box, idx) => (
                <div
                  key={box.id}
                  onClick={() => setSelectedBoxFor3D(idx)}
                  className={`grid grid-cols-2 sm:grid-cols-6 gap-2 p-3 rounded-lg border items-center text-xs shadow-xs cursor-pointer transition ${
                    selectedBoxFor3D === idx
                      ? "bg-indigo-50/70 border-indigo-400 ring-1 ring-indigo-300"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-0.5">Box #{idx + 1} Qty</span>
                    <input
                      type="number"
                      min={1}
                      value={box.qty}
                      onChange={(e) => updateBox(box.id, "qty", Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 block mb-0.5">Weight (Kg/box)</span>
                    <input
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={box.weight}
                      onChange={(e) => updateBox(box.id, "weight", parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 block mb-0.5">Length (cm)</span>
                    <input
                      type="number"
                      min={1}
                      value={box.length}
                      onChange={(e) => updateBox(box.id, "length", parseFloat(e.target.value) || 1)}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 block mb-0.5">Width (cm)</span>
                    <input
                      type="number"
                      min={1}
                      value={box.width}
                      onChange={(e) => updateBox(box.id, "width", parseFloat(e.target.value) || 1)}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 block mb-0.5">Height (cm)</span>
                    <input
                      type="number"
                      min={1}
                      value={box.height}
                      onChange={(e) => updateBox(box.id, "height", parseFloat(e.target.value) || 1)}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono"
                    />
                  </div>

                  <div className="flex items-center justify-between sm:justify-end space-x-3 pt-3 sm:pt-0">
                    <span className="text-[11px] text-slate-500 font-mono">
                      {((box.length * box.width * box.height) / (selectedMode === "air" ? 5000 : 4500)).toFixed(1)} kg vol
                    </span>
                    {boxes.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeBox(box.id);
                        }}
                        className="text-rose-500 hover:text-rose-700 p-1 rounded"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {!highVolumeMode && (
              <div className="lg:col-span-4 flex justify-center">
                <Interactive3DBox length={currentBox3D.length} width={currentBox3D.width} height={currentBox3D.height} />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 text-xs shadow-xs">
            <div className="flex flex-wrap gap-5">
              <div>
                <span className="text-slate-500">Dead Wt: </span>
                <span className="font-bold text-slate-900 font-mono">{totalActualWeight.toFixed(1)} kg</span>
              </div>
              <div>
                <span className="text-slate-500">Volumetric: </span>
                <span className="font-bold text-indigo-700 font-mono">{totalVolumetricWeight.toFixed(2)} kg</span>
              </div>
              <div>
                <span className="text-slate-500">Billable: </span>
                <span className="font-bold text-emerald-700 font-mono text-sm">{billableWeight.toFixed(1)} kg</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quotes List */}
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">Direct Carrier Freight Tariffs</h3>
            <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-full font-bold">
              {calculatedQuotes.length} Available Rates
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {calculatedQuotes.map((quote) => (
              <div
                key={quote.rateCard.id}
                className="bg-white border border-slate-200 hover:border-indigo-400 rounded-xl p-5 transition-all shadow-xs"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-3">
                      <span className="text-base font-bold text-slate-900">{quote.vendor.name}</span>
                      <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-bold px-2 py-0.5 rounded-full">
                        {quote.vendor.badge}
                      </span>
                      <span className="text-amber-500 text-xs font-bold">★ {quote.vendor.rating}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center space-x-1 text-slate-700 font-medium capitalize">
                        {quote.rateCard.mode === "air" ? (
                          <PlaneIcon className="w-4 h-4 text-sky-600" />
                        ) : (
                          <TruckIcon className="w-4 h-4 text-emerald-600" />
                        )}
                        <span>{quote.rateCard.mode} Freight</span>
                      </span>
                      <span>•</span>
                      <span>SLA: <strong className="text-slate-800">{quote.rateCard.sla_days} Days</strong></span>
                      <span>•</span>
                      <span>Billable: <strong className="text-slate-800">{quote.billableWeight} kg</strong></span>
                      <span>•</span>
                      <span className="font-mono text-emerald-700 font-bold">UPI: {quote.vendor.upi_id}</span>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs grid grid-cols-3 sm:grid-cols-5 gap-2 text-center sm:text-left">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Base</span>
                      <span className="font-semibold">{formatINR(quote.breakdown.base)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Fuel</span>
                      <span className="font-semibold">{formatINR(quote.breakdown.fuel)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Docket/FOV</span>
                      <span className="font-semibold">{formatINR(quote.breakdown.docket + quote.breakdown.fov)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">GST 18%</span>
                      <span className="font-semibold">{formatINR(quote.breakdown.gst)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-indigo-600 block font-bold">Platform (2%)</span>
                      <span className="font-bold text-indigo-700">₹{quote.breakdown.platformConvenienceFee}</span>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0">
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-slate-500 block font-bold">Total Outlay</span>
                      <span className="text-xl font-black text-emerald-700">{formatINR(quote.breakdown.total)}</span>
                    </div>
                    <button
                      onClick={() => onSelectQuoteForBooking(quote)}
                      className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition flex items-center space-x-1.5 shadow-sm"
                    >
                      <span>Direct Book</span>
                      <ArrowRightIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
