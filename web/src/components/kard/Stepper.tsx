import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle } from "lucide-react";

export function Stepper({
  value,
  onChange,
  min,
  max,
  step,
  unit,
}: {
  value: number | "";
  onChange: (v: number | "") => void;
  min: number;
  max: number;
  step: number;
  unit: string;
}) {
  const numValue = value === "" ? min : value;
  const [errorMsg, setErrorMsg] = useState("");

  const inc = () => {
    if (value === "") {
      onChange(min);
      setErrorMsg("");
      return;
    }
    let next = numValue + step;
    if (next > max) {
      setErrorMsg(`Maximum value is ${max}`);
      return;
    }
    setErrorMsg("");
    if (next < min) next = min;
    onChange(parseFloat(Math.min(max, next).toFixed(10)));
  };

  const dec = () => {
    if (value === "") {
      onChange(min);
      setErrorMsg("");
      return;
    }
    let next = numValue - step;
    if (next < min) {
      setErrorMsg(`Minimum value is ${min}`);
      return;
    }
    setErrorMsg("");
    if (next > max) next = max;
    onChange(parseFloat(Math.max(min, next).toFixed(10)));
  };

  const display = value === "" ? "" : (Number.isInteger(step) ? String(value) : (value as number).toFixed(1));

  const [localValue, setLocalValue] = useState(display);

  useEffect(() => {
    setLocalValue(display);
  }, [display]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
    setErrorMsg("");
  };

  const handleBlur = () => {
    if (localValue.trim() === "") {
      onChange("");
      setLocalValue("");
      setErrorMsg("");
      return;
    }
    let parsed = parseFloat(localValue);
    if (isNaN(parsed)) {
      setLocalValue(display);
      return;
    }
    if (parsed < min) {
      setErrorMsg(`Minimum value is ${min}`);
    } else if (parsed > max) {
      setErrorMsg(`Maximum value is ${max}`);
    } else {
      setErrorMsg("");
    }
    parsed = Math.max(min, Math.min(max, parsed));
    onChange(parseFloat(parsed.toFixed(10)));
    setLocalValue(Number.isInteger(step) ? String(parsed) : parsed.toFixed(1));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleBlur();
    }
  };

  return (
    <div className="flex flex-col items-start gap-2.5 w-full max-w-xs">
      <div className="flex items-center justify-between w-full bg-card border border-border rounded-2xl px-4 py-5">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={dec}
          data-testid="stepper-dec"
          aria-label={`Decrease ${unit}`}
          className="w-12 h-12 rounded-full border border-border text-xl font-light text-foreground hover:bg-secondary active:scale-95 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none flex items-center justify-center"
        >
          −
        </button>
        <div className="flex flex-col items-center" aria-live="polite" aria-atomic="true">
          <input
            type="text"
            inputMode={Number.isInteger(step) ? "numeric" : "decimal"}
            value={localValue}
            onChange={handleInputChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="text-6xl font-semibold tracking-tight text-foreground tabular-nums leading-none text-center bg-transparent border-none focus:outline-none w-32 caret-primary"
            aria-label={`Current ${unit} value`}
          />
          <span className="text-sm text-muted-foreground mt-1.5">{unit}</span>
        </div>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={inc}
          data-testid="stepper-inc"
          aria-label={`Increase ${unit}`}
          className="w-12 h-12 rounded-full border border-border text-xl font-light text-foreground hover:bg-secondary active:scale-95 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none flex items-center justify-center"
        >
          +
        </button>
      </div>
      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="bg-red-600 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 shadow-sm"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {errorMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
