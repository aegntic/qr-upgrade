import { useState } from "react";
import { Linking, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useIsFocused } from "expo-router";
import { useDraft } from "../src/draft";
import { Button, Copy, Heading, Page, useTheme } from "../src/ui";
import { useForeground } from "../src/privacy-cover";
export default function Camera() {
  const active = useForeground();
  const [permission, request] = useCameraPermissions(),
    [result, setResult] = useState<boolean | null>(null),
    [error, setError] = useState("");
  const { generated } = useDraft(),
    focused = useIsFocused(),
    t = useTheme();
  return (
    <Page>
      <Heading
        step="REAL-WORLD CHECK"
        title="Give it a real scan."
        description="Point at a printed copy. We compare what the camera reads with your current QR content."
      />
      {permission?.granted ? (
        <>
          <View
            style={{
              height: 370,
              borderRadius: 22,
              overflow: "hidden",
              backgroundColor: "#193c2f",
            }}
          >
            {focused && active && result === null ? (
              <CameraView
                style={{ flex: 1 }}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={(e) => setResult(e.data === generated.text)}
                onMountError={(e) => setError(e.message)}
              />
            ) : (
              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 25,
                }}
              >
                <Text
                  style={{ color: "#fff", fontSize: 26, textAlign: "center" }}
                >
                  {result ? "✓ Exact match" : "Different QR content"}
                </Text>
              </View>
            )}
          </View>
          {result !== null ? (
            <>
              <Copy>
                {result
                  ? "This physical scan matched your draft. Test a few distances and lighting conditions before a full print run."
                  : "The scanned QR contains different content. We have not opened its destination."}
              </Copy>
              <Button title="Scan again" onPress={() => setResult(null)} />
            </>
          ) : null}
        </>
      ) : (
        <>
          <Copy muted>
            Camera access is only needed for this optional printed-code check.
          </Copy>
          <Button
            title={
              permission?.canAskAgain === false
                ? "Open camera settings"
                : "Allow camera access"
            }
            onPress={() => {
              if (permission?.canAskAgain === false)
                void Linking.openSettings();
              else
                void request().catch(() =>
                  setError("Camera permission could not be requested."),
                );
            }}
          />
        </>
      )}
      {error ? (
        <Text accessibilityRole="alert" style={{ color: t.error }}>
          {error}
        </Text>
      ) : null}
    </Page>
  );
}
