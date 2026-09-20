import React, { forwardRef } from "react";
import Svg, { Circle, Rect, G, Image } from "react-native-svg";
import { Appearance, Matrix } from "../../shared/qr";
export const Symbol = forwardRef<
  Svg,
  { matrix: Matrix; appearance: Appearance; size?: number; artwork?: string }
>(function Symbol({ matrix, appearance: a, size = 210, artwork }, ref) {
  const side = matrix.size + 2 * a.quietZone;
  if (artwork)
    return (
      <Svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 512 512"
        accessibilityLabel="Your custom QR artwork"
      >
        <Image
          href={{ uri: `data:image/png;base64,${artwork}` }}
          width={512}
          height={512}
        />
      </Svg>
    );

  const marks = [];
  for (let y = 0; y < matrix.size; y++)
    for (let x = 0; x < matrix.size; x++) {
      const i = y * matrix.size + x;
      if (!matrix.data[i]) continue;
      const reserved = matrix.reservedBit[i] === 1;
      marks.push(
        a.style === "dot" && !reserved ? (
          <Circle
            key={i}
            cx={x + a.quietZone + 0.5}
            cy={y + a.quietZone + 0.5}
            r={0.48}
          />
        ) : (
          <Rect
            key={i}
            x={x + a.quietZone}
            y={y + a.quietZone}
            width={1}
            height={1}
            rx={a.style === "soft" && !reserved ? 0.2 : 0}
          />
        ),
      );
    }
  return (
    <Svg
      ref={ref}
      width={size}
      height={size}
      viewBox={`0 0 ${side} ${side}`}
      accessibilityLabel="Your QR code"
    >
      <Rect width={side} height={side} fill={a.background} />
      <G fill={a.foreground}>{marks}</G>
    </Svg>
  );
});
export function capture(
  ref: React.RefObject<Svg | null>,
  size = 1024,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!ref.current) {
      reject(new Error("Wait for your QR preview to load."));
      return;
    }
    const timeout = setTimeout(
      () => reject(new Error("Preview capture timed out. Try again.")),
      10000,
    );
    ref.current.toDataURL(
      (data) => {
        clearTimeout(timeout);
        resolve(data);
      },
      { width: size, height: size },
    );
  });
}
