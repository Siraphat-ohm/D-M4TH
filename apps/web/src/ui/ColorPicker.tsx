import { textColorForBackground } from "./format";

const COLOR_PICKER_FALLBACK = "#EF476F";

const PRESET_COLORS = [
  "#EF476F",
  "#8B5CF6",
  "#06D6A0",
  "#FFD166",
  "#118AB2",
  "#F97316"
] as const;

export function ColorPicker(props: { value: string; onChange: (color: string) => void }) {
  const selectedColor = normalizeColorValue(props.value).toLowerCase();

  return (
    <div className="color-picker">
      <div className="color-swatches">
        {PRESET_COLORS.map((presetColor) => {
          const isSelected = selectedColor === presetColor.toLowerCase();

          return (
            <button
              type="button"
              key={presetColor}
              className={`color-swatch${isSelected ? " selected" : ""}`}
              style={{
                background: presetColor,
                color: textColorForBackground(presetColor)
              }}
              onClick={() => props.onChange(presetColor)}
              aria-label={`Select color ${presetColor}`}
              aria-pressed={isSelected}
            >
              {isSelected ? "✓" : ""}
            </button>
          );
        })}
      </div>
      <div className="color-custom-row">
        <span>Custom</span>
        <input
          type="color"
          className="color-custom-input"
          value={selectedColor}
          onChange={(event) => props.onChange(event.target.value)}
          aria-label="Custom player color"
        />
      </div>
    </div>
  );
}

function normalizeColorValue(value: string): string {
  return isHexColor(value) ? value : COLOR_PICKER_FALLBACK;
}

function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}
