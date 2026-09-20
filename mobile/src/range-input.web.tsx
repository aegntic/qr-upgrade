import React from "react";
import type { SliderProps } from "@react-native-community/slider";
export default function RangeInput(props: SliderProps) {
  return (
    <input
      type="range"
      aria-label={props.accessibilityLabel}
      aria-valuetext={props.accessibilityValue?.text}
      value={props.value}
      min={props.minimumValue}
      max={props.maximumValue}
      step={props.step}
      disabled={props.disabled}
      onChange={(event) => props.onValueChange?.(Number(event.target.value))}
      style={{
        width: "100%",
        height: 44,
        accentColor: "#637b4e",
        cursor: "pointer",
      }}
    />
  );
}
