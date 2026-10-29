import { Minus, Plus } from "lucide-react";

export default function QuantityStepper({ value, onChange, min = 1, max = 20, label = "Quantity" }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label="Decrease quantity">
        <Minus size={16} />
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="Increase quantity">
        <Plus size={16} />
      </button>
    </div>
  );
}
