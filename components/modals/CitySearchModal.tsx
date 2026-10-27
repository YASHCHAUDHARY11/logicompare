
"use client";

import React, { useState } from "react";
import { XMarkIcon } from "@/components/icons";

interface CitySearchModalProps {
  target: "origin" | "dest";
  onSelectPin: (pin: string) => void;
  onClose: () => void;
}

export function CitySearchModal({ target, onSelectPin, onClose }: CitySearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ name: string; district: string; state: string; pincode: string }>>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query || query.length < 3) return;
    setLoading(true);
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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-base font-bold text-slate-900">Find PIN Code for {target === "origin" ? "Origin" : "Destination"}</h3>
          <button onClick={onClose}><XMarkIcon className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. Ludhiana, Meerut, Panipat..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 border rounded-lg px-3 py-2 text-xs"
            autoFocus
          />
          <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold">
            {loading ? "..." : "Search"}
          </button>
        </form>

        <div className="max-h-60 overflow-y-auto space-y-2">
          {results.map((item, idx) => (
            <div
              key={idx}
              onClick={() => { onSelectPin(item.pincode); onClose(); }}
              className="flex justify-between p-2 rounded hover:bg-indigo-50 cursor-pointer text-xs"
            >
              <div>
                <p className="font-bold">{item.name}</p>
                <p className="text-[11px] text-slate-500">{item.district}, {item.state}</p>
              </div>
              <span className="font-mono font-bold text-indigo-700">{item.pincode}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
