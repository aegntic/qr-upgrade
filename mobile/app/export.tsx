import { useRef, useState } from "react";
import { Text, View, Platform } from "react-native";
import { useRouter } from "expo-router";
import Svg from "react-native-svg";
import { useDraft } from "../src/draft";
import {
  Button,
  Card,
  Choices,
  Copy,
  Heading,
  Page,
  useTheme,
} from "../src/ui";
import { Symbol, capture } from "../src/symbol";
import { decodePng, exportFile } from "../src/files";
export default function Export() {
  const { draft, generated, report, key, setVerification } = useDraft(),
    t = useTheme(),
    router = useRouter(),
    ref = useRef<Svg>(null);
  const [format, setFormat] = useState<"png" | "pdf">("png"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const available = report.score === 100 && !!generated.svg;
  async function save() {
    if (!available || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const pixels = Math.min(
        6000,
        Math.max(1024, Math.ceil((draft.sizeMm / 25.4) * 300)),
      );
      const png = await capture(ref, pixels);
      const ok = await decodePng(png, generated.text);
      setVerification({
        key,
        ok,
        message: ok ? "Export read-back passed." : "Export read-back failed.",
      });
      if (!ok)
        throw new Error(
          "This QR did not decode. Return to Scan Lab and increase scan strength or repair scanability.",
        );
      await exportFile(format, generated.svg, png, draft.sizeMm);
      setMessage(
        Platform.OS === "web"
          ? "Download started."
          : "Share sheet closed. Check your chosen destination for the file.",
      );
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Export failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page>
      <Heading
        step="03 / EXPORT"
        title="Ready for the world."
        description="A clean file for your next print. Every export runs an exact-content read-back check."
      />
      <Card>
        <View style={{ alignItems: "center", gap: 14, paddingVertical: 10 }}>
          {generated.matrix && generated.png ? (
            <Symbol
              ref={ref}
              matrix={generated.matrix}
              artwork={generated.png}
              appearance={draft.appearance}
            />
          ) : null}
          <Copy>{draft.brand}</Copy>
          <Copy muted size={13}>
            {draft.sizeMm} × {draft.sizeMm} mm · {report.score}/100 checklist
          </Copy>
        </View>
      </Card>
      <Card>
        <Choices
          label="File format"
          value={format}
          options={[
            { value: "png", label: "PNG" },
            { value: "pdf", label: "PDF" },
          ]}
          onChange={setFormat}
        />
        <Copy muted size={13}>
          {format === "png"
            ? "A high-resolution image sized for at least 300 pixels per inch at your selected print width."
            : "An RGB PDF page at your selected dimensions. Ask your printer to confirm any required color conversion."}
        </Copy>
        <Copy muted size={12}>
          Export contains the complete QR artwork and its clear border. Scene
          photos and the brand caption are preview elements.
        </Copy>
      </Card>
      {!available ? (
        <Card>
          <Copy>There are print settings to fix first.</Copy>
          <Button
            title="Back to Scan Lab"
            secondary
            onPress={() => router.back()}
          />
        </Card>
      ) : null}
      <Button
        title={
          busy ? "Checking and preparing…" : `Export ${format.toUpperCase()}`
        }
        onPress={save}
        disabled={!available || busy}
      />
      {message ? (
        <Text
          accessibilityRole="alert"
          style={{ color: t.ink, lineHeight: 22 }}
        >
          {message}
        </Text>
      ) : null}
      <Copy muted size={12}>
        Print at 100% scale. Try the final material in realistic light with more
        than one phone. A successful digital check cannot guarantee every
        printed scan.
      </Copy>
      <Button
        title="Back to studio"
        secondary
        onPress={() => router.dismissTo("/")}
      />
    </Page>
  );
}
