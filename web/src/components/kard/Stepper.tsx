import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle } from "lucide-react";

// A number with − and + buttons that can also be typed. Only digits can be typed (and one decimal point where the
// step allows it). A typed value is checked when the field is left or Enter is pressed: if it is empty or outside
// min..max the field says why and reports "" upwards, so the screen cannot move on with a value nobody entered.
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
  const decimal = !Number.isInteger(step);
  const format = (v: number) => (decimal ? v.toFixed(1) : String(Math.round(v)));
  const inRange = (v: number) => v >= min && v <= max;
  const rangeMsg = `Enter a value from ${min} to ${max}`;

  const [text, setText] = useState(value === "" ? "" : format(value));
  const [errorMsg, setErrorMsg] = useState("");
  const focused = useRef(false);

  // follow a value set from outside (the − and + buttons, "Not sure"), but never overwrite what is being typed
  useEffect(() => {
    if (!focused.current && value !== "") { setText(format(value)); setErrorMsg(""); }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const stepBy = (dir: 1 | -1) => {
    const typed = parseFloat(text);
    const from = Number.isFinite(typed) ? typed : value === "" ? (dir > 0 ? min - step : max + step) : value;
    const target = from + dir * step;
    if (inRange(from) && !inRange(target)) {
      setErrorMsg(dir > 0 ? `Maximum value is ${max}` : `Minimum value is ${min}`);
      return;
    }
    const next = parseFloat(Math.min(max, Math.max(min, target)).toFixed(10));
    setErrorMsg("");
    setText(format(next));
    onChange(next);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const clean = (decimal ? raw.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1") : raw.replace(/\D/g, "")).slice(0, 6);
    setText(clean);
    setErrorMsg(clean === raw ? "" : !decimal && /^[\d.,]*$/.test(raw) ? "Whole numbers only" : "Numbers only");
    // report validity on every keystroke, so the screen can never move on with a value that is not valid, whether
    // or not the field has been left; the message explaining why waits until then, to avoid nagging mid-typing
    const n = parseFloat(clean);
    onChange(Number.isFinite(n) && inRange(n) ? n : "");
  };

  const commit = () => {
    const n = parseFloat(text);
    if (text.trim() === "" || !Number.isFinite(n)) {
      setText("");
      setErrorMsg("Enter a number");
      onChange("");
    } else if (!inRange(n)) {
      setErrorMsg(rangeMsg);
      onChange("");
    } else {
      setErrorMsg("");
      setText(format(n));
      onChange(parseFloat(n.toFixed(decimal ? 1 : 0)));
    }
  };

  const errorId = `stepper-error-${unit.replace(/[^a-z0-9]+/gi, "-")}`;
  const btn = "w-12 h-12 rounded-full border border-border text-xl font-light text-foreground hover:bg-secondary active:scale-95 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none flex items-center justify-center";

  return (
    <div className="flex flex-col items-start gap-2.5 w-full max-w-xs">
      <div className={`flex items-center justify-between w-full bg-card border rounded-2xl px-4 py-5 transition-colors ${errorMsg ? "border-red-500" : "border-border"}`}>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => stepBy(-1)} data-testid="stepper-dec" aria-label={`Decrease ${unit}`} className={btn}>
          −
        </button>
        <div className="flex flex-col items-center">
          <input
            type="text"
            inputMode={decimal ? "decimal" : "numeric"}
            autoComplete="off"
            value={text}
            onChange={handleInputChange}
            onFocus={() => { focused.current = true; }}
            onBlur={() => { focused.current = false; commit(); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
            aria-invalid={errorMsg !== "" || undefined}
            aria-describedby={errorMsg ? errorId : undefined}
            className="text-6xl font-semibold tracking-tight text-foreground tabular-nums leading-none text-center bg-transparent border-none focus:outline-none w-32 caret-primary"
            aria-label={`${unit} (${min} to ${max})`}
          />
          <span className="text-sm text-muted-foreground mt-1.5">{unit}</span>
        </div>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => stepBy(1)} data-testid="stepper-inc" aria-label={`Increase ${unit}`} className={btn}>
          +
        </button>
      </div>
      <AnimatePresence>
        {errorMsg && (
          <motion.div
            id={errorId}
            role="alert"
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
