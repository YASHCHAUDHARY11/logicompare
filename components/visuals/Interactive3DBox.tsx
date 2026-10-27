"use client";

import React, { useState, useEffect, useRef } from "react";

interface Interactive3DBoxProps {
  length: number;
  width: number;
  height: number;
}

export function Interactive3DBox({ length, width, height }: Interactive3DBoxProps) {
  const [rotX, setRotX] = useState(-20);
  const [rotY, setRotY] = useState(35);
  const [isDragging, setIsDragging] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!autoRotate || isDragging) return;
    const interval = setInterval(() => {
      setRotY((prev) => (prev + 0.6) % 360);
    }, 30);
    return () => clearInterval(interval);
  }, [autoRotate, isDragging]);

  const maxDim = Math.max(length, width, height, 20);
  const scale = 110 / maxDim;
  const l = Math.max(45, Math.min(150, length * scale));
  const w = Math.max(45, Math.min(150, width * scale));
  const h = Math.max(45, Math.min(150, height * scale));

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setAutoRotate(false);
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    setRotY((prev) => prev + dx * 0.7);
    setRotX((prev) => Math.max(-75, Math.min(75, prev - dy * 0.7)));
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <div className="flex flex-col items-center select-none bg-gradient-to-b from-slate-900/80 to-slate-950 p-4 rounded-2xl border border-slate-700/60 shadow-xl backdrop-blur-md w-full">
      <div className="flex items-center justify-between w-full mb-2">
        <span className="text-[10px] uppercase font-black tracking-wider text-indigo-300 flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping mr-1"></span>
          Live 3D Carton Visualizer
        </span>
        <button
          type="button"
          onClick={() => setAutoRotate(!autoRotate)}
          className="text-[10px] font-bold text-slate-300 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 transition"
        >
          {autoRotate ? "Pause 360°" : "Auto 360°"}
        </button>
      </div>

      <div
        className="w-48 h-44 flex items-center justify-center cursor-grab active:cursor-grabbing"
        style={{ perspective: "800px" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          className="relative transition-transform duration-75"
          style={{
            width: `${l}px`,
            height: `${h}px`,
            transformStyle: "preserve-3d",
            transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`
          }}
        >
          {/* Front Face */}
          <div
            className="absolute inset-0 bg-gradient-to-br from-amber-700 via-amber-600 to-amber-800 border border-amber-900/60 shadow-inner flex flex-col justify-between p-2 text-white overflow-hidden rounded-sm"
            style={{ transform: `translateZ(${w / 2}px)` }}
          >
            <div className="flex justify-between items-start opacity-90">
              <span className="text-[8px] font-black uppercase tracking-widest text-amber-950 bg-amber-400 px-1 py-0.5 rounded-sm">
                FRAGILE
              </span>
              <span className="text-[7px] font-mono text-amber-200">↑ THIS SIDE UP</span>
            </div>
            <div className="flex flex-col items-center my-auto">
              <div className="w-12 h-3.5 bg-white/90 rounded-sm flex items-center justify-center space-x-0.5 px-1 py-0.5 shadow-sm">
                {[1, 2, 1, 3, 1, 2, 1, 2, 1, 3, 1].map((n, i) => (
                  <div key={i} className="bg-black h-full" style={{ width: `${n}px` }} />
                ))}
              </div>
              <span className="text-[7px] font-mono font-black text-amber-100 tracking-wider mt-0.5">
                {length}×{width}×{height} CM
              </span>
            </div>
            <div className="h-1.5 w-full bg-amber-950/60 rounded-sm"></div>
          </div>

          {/* Back Face */}
          <div
            className="absolute inset-0 bg-gradient-to-br from-amber-800 to-amber-900 border border-amber-950 flex items-center justify-center text-amber-300 font-mono text-[8px] font-bold"
            style={{ transform: `rotateY(180deg) translateZ(${w / 2}px)` }}
          >
            <span>LOGICOMPARE B2B</span>
          </div>

          {/* Left Face */}
          <div
            className="absolute bg-gradient-to-br from-amber-800 via-amber-700 to-amber-900 border border-amber-950 flex flex-col justify-center items-center text-amber-200"
            style={{
              width: `${w}px`,
              height: `${h}px`,
              left: `${(l - w) / 2}px`,
              transform: `rotateY(-90deg) translateZ(${l / 2}px)`
            }}
          >
            <span className="text-[7px] font-bold rotate-90 opacity-75">WIDTH: {width}cm</span>
          </div>

          {/* Right Face */}
          <div
            className="absolute bg-gradient-to-br from-amber-700 via-amber-800 to-amber-900 border border-amber-950 flex flex-col justify-center items-center text-amber-200"
            style={{
              width: `${w}px`,
              height: `${h}px`,
              left: `${(l - w) / 2}px`,
              transform: `rotateY(90deg) translateZ(${l / 2}px)`
            }}
          >
            <span className="text-[7px] font-bold -rotate-90 opacity-75">HT: {height}cm</span>
          </div>

          {/* Top Face */}
          <div
            className="absolute bg-gradient-to-br from-amber-600 via-amber-500 to-amber-700 border border-amber-900 flex items-center justify-center overflow-hidden"
            style={{
              width: `${l}px`,
              height: `${w}px`,
              top: `${(h - w) / 2}px`,
              transform: `rotateX(90deg) translateZ(${h / 2}px)`
            }}
          >
            <div className="w-full h-3 bg-amber-400/50 shadow-inner flex items-center justify-center">
              <span className="text-[6px] font-black text-amber-950 tracking-widest uppercase">HEAVY DUTY SEAL</span>
            </div>
          </div>

          {/* Bottom Face */}
          <div
            className="absolute bg-amber-950 shadow-2xl"
            style={{
              width: `${l}px`,
              height: `${w}px`,
              top: `${(h - w) / 2}px`,
              transform: `rotateX(-90deg) translateZ(${h / 2}px)`
            }}
          />
        </div>
      </div>
      <span className="text-[9px] text-slate-400 mt-1 font-mono">Drag with mouse to rotate 360°</span>
    </div>
  );
}
