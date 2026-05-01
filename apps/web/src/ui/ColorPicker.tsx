import { useEffect, useState } from "react";

const COLOR_PICKER_DEFAULT_CUSTOM = "#f97316";

const PRESET_COLORS = [
  "#f97316",
  "#e63946",
  "#d63384",
  "#9b5de5",
  "#4361ee",
  "#3a86ff",
  "#4cc9f0",
  "#06d6a0",
  "#2dc653",
  "#ffd166",
  "#f77f00",
  "#ef476f"
] as const;

export function ColorPicker(props: { value: string; onChange: (color: string) => void }) {
  const [customColor, setCustomColor] = useState(() => (isPresetColor(props.value) ? COLOR_PICKER_DEFAULT_CUSTOM : props.value));
  const selectedColor = props.value.toLowerCase();

  useEffect(() => {
    if (!isPresetColor(props.value)) {
      setCustomColor(props.value);
    }
  }, [props.value]);

  return (
    <div className="color-picker">
      <div className="color-swatches">
        {PRESET_COLORS.map((presetColor) => (
          <button
            key={presetColor}
            className={`color-swatch${selectedColor === presetColor ? " selected" : ""}`}
            style={{
              background: presetColor,
              color: textColorForSwatch(presetColor)
            }}
            onClick={() => props.onChange(presetColor)}
            aria-label={`Select color ${presetColor}`}
          >
            {selectedColor === presetColor ? "✓" : ""}
          </button>
        ))}
      </div>
      <div className="color-custom-row">
        <span>Custom</span>
        <input
          type="color"
          className="color-custom-input"
          value={customColor}
          onChange={(event) => {
            const nextColor = event.target.value;
            setCustomColor(nextColor);
            props.onChange(nextColor);
          }}
        />
      </div>
    </div>
  );
}

function isPresetColor(value: string): boolean {
  return (PRESET_COLORS as readonly string[]).includes(value.toLowerCase());
}

function textColorForSwatch(hex: string): string {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  const luminance = (r * 299 + g * 587 + b * 114) / 1000;
  return luminance > 150 ? "#111827" : "#f8fafc";
}
