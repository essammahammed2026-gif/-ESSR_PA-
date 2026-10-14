import React from "react";

interface NumberControlProps {
  label: string;
  value: string;
  min: string;
  max: string;
  step: string;
  unit?: string;
  onChange: (val: string) => void;
}

/** Shared +/- stepper for string-valued numeric inputs (fix.md Phase 2.4). */
export const NumberControl: React.FC<NumberControlProps> = ({
  label,
  value,
  min,
  max,
  step,
  unit = "",
  onChange
}) => {
  const handleDec = () => onChange(String(Math.max(Number(min), Number(value) - Number(step))));
  const handleInc = () => onChange(String(Math.min(Number(max), Number(value) + Number(step))));

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-xs">
        <label className="font-semibold text-slate-300">{label}</label>
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={handleDec}
            className="w-6 h-6 flex items-center justify-center bg-[#232936] rounded text-slate-300 hover:bg-[#2E3648] hover:text-white font-bold transition-colors"
          >
            -
          </button>
          <div className="flex items-center bg-[#131720] border border-[#2E3648] rounded px-1.5 py-0.5">
            <input
              type="number"
              min={min}
              max={max}
              step={step}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-12 text-xs bg-transparent text-center text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none outline-none font-mono"
            />
            {unit && <span className="text-[10px] text-slate-400 ml-0.5">{unit}</span>}
          </div>
          <button
            type="button"
            onClick={handleInc}
            className="w-6 h-6 flex items-center justify-center bg-[#232936] rounded text-slate-300 hover:bg-[#2E3648] hover:text-white font-bold transition-colors"
          >
            +
          </button>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-1.5 bg-[#232936] rounded-lg appearance-none cursor-pointer accent-pink-500"
      />
    </div>
  );
};
