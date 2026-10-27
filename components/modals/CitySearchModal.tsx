"use client";

import React, { useState } from "react";
import { XMarkIcon, SearchIcon, MapPinIcon } from "@/components/icons";

interface CitySearchModalProps {
  target: "origin" | "dest";
  onSelectPin: (pin: string) => void;
  onClose: () => void;
}

export function CitySearchModal({ target, onSelectPin, onClose }: CitySearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ name: string; district: string; state: string; pincode: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query || query.trim().length < 3) return;
    setLoading(true);
    setHasSearched(true);
    try {
      const res = await fetch(`https://api.postalpincode.in/postoffice/${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (data && data[0]?.Status === "Success" && data[0]?.PostOffice) {
        setResults(
          data[0].PostOffice.map((item: any) => ({
            name: item.Name,
            district: item.District,
            state: item.State,
            pincode: item.Pincode
          }))
        );
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-white border border-slate-300 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-black text-slate-900">
              Find PIN Code for {target === "origin" ? "Origin" : "Destination"}
            </h3>
            <p className="text-xs text-slate-500 font-medium">Search Indian cities, districts, or branch post offices</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="e.g. Ludhiana, Meerut, Panipat, Bhiwandi..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none"
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-black shadow-sm flex items-center space-x-1.5 transition disabled:opacity-50"
          >
            <SearchIcon className="w-4 h-4" />
            <span>{loading ? "..." : "Search"}</span>
          </button>
        </form>

        <div className="max-h-64 overflow-y-auto space-y-2 divide-y divide-slate-100 pr-1">
          {results.length > 0 ? (
            results.map((item, idx) => (
              <div
                key={idx}
                onClick={() => {
                  onSelectPin(item.pincode);
                  onClose();
                }}
                className="pt-2 flex items-center justify-between p-2 rounded-xl hover:bg-indigo-50/80 cursor-pointer transition text-xs group"
              >
                <div>
                  <p className="font-bold text-slate-900 group-hover:text-indigo-900 flex items-center space-x-1">
                    <MapPinIcon className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{item.name}</span>
                  </p>
                  <p className="text-[11px] text-slate-500">{item.district}, {item.state}</p>
                </div>
                <span className="font-mono font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg">
                  {item.pincode}
                </span>
              </div>
            ))
          ) : hasSearched && !loading ? (
            <p className="text-center text-xs text-slate-400 py-6">No matching post offices found. Try another city name.</p>
          ) : (
            <p className="text-center text-xs text-slate-400 py-6">Type at least 3 letters of your city and press search.</p>
          )}
        </div>
      </div>
    </div>
  );
}
