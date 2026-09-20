import { useEffect, useRef, useState } from "react";
import { ImageBackground, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import Svg from "react-native-svg";
import { useDraft, Scene } from "../src/draft";
import {
  Button,
  Card,
  Choices,
  Copy,
  Heading,
  Page,
  Range,
  useTheme,
} from "../src/ui";
import { Symbol, capture } from "../src/symbol";
import { decodePng } from "../src/files";
const scenes = {
  packaging: require("../assets/scenes/packaging.png"),
  poster: require("../assets/scenes/poster.png"),
  card: require("../assets/scenes/card.png"),
};
export default function Test() {
  const {
      draft,
      patch,
      appearance,
      generated,
      report,
      fix,
      verification,
      setVerification,
      key,
      verified,
    } = useDraft(),
    router = useRouter(),
    t = useTheme();
  const ref = useRef<Svg>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [width, setWidth] = useState(300),
    currentKey = useRef(key),
    mounted = useRef(true);
  currentKey.current = key;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const check = async () => {
    const checkKey = key,
      expected = generated.text;
    setBusy(true);
    setError("");
    try {
      const png = await capture(ref);
      const ok = await decodePng(png, expected);
      if (mounted.current && currentKey.current === checkKey)
        setVerification({
          key: checkKey,
          ok,
          message: ok
            ? "Rendered QR decodes to your exact content."
            : "The rendered QR did not decode. Increase scan strength or try Repair scanability.",
        });
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : "Could not run the check.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const pick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsEditing: false,
      });
      if (!result.canceled) {
        const asset = result.assets[0];
        if (
          (asset.fileSize ?? 0) > 8 * 1024 * 1024 ||
          asset.width * asset.height > 40000000
        )
          throw new Error("Choose a photo below 8 MB and 40 megapixels.");
        patch({ photo: asset.uri });
      }
    } catch {
      setError(
        "Photo access is unavailable. You can still use a sample scene.",
      );
    }
  };
  const size = Math.min(width * 0.34, Math.max(55, draft.sizeMm * 1.8));
  return (
    <Page>
      <Heading
        step="02 / TEST"
        title="See it out there."
        description="Preview placement, check print settings, then read back the actual QR."
      />
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{
          height: 330,
          borderRadius: 20,
          overflow: "hidden",
          backgroundColor: t.line,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Scene preview. Tap to reposition the QR."
          onPress={(e) =>
            patch({
              x: Math.max(
                20,
                Math.min(80, (e.nativeEvent.locationX / width) * 100),
              ),
              y: Math.max(
                20,
                Math.min(80, (e.nativeEvent.locationY / 330) * 100),
              ),
            })
          }
          style={{ flex: 1 }}
        >
          <ImageBackground
            source={draft.photo ? { uri: draft.photo } : scenes[draft.scene]}
            resizeMode="cover"
            style={{ flex: 1 }}
          >
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: `${draft.x}%`,
                top: `${draft.y}%`,
                marginLeft: -size / 2,
                marginTop: -size / 2,
                transform: [{ rotate: `${draft.rotation}deg` }],
                alignItems: "center",
                gap: 5,
              }}
            >
              {generated.matrix && generated.png ? (
                <Symbol
                  matrix={generated.matrix}
                  artwork={generated.png}
                  appearance={draft.appearance}
                  size={size}
                />
              ) : null}
              <Text
                style={{
                  fontSize: 9,
                  letterSpacing: 1,
                  color: "#193c2f",
                  backgroundColor: "#ffffff",
                  padding: 3,
                }}
              >
                {draft.brand}
              </Text>
            </View>
          </ImageBackground>
        </Pressable>
      </View>
      <Copy muted size={12}>
        Tap the scene to place your QR. This is a visual mockup; the photo has
        no physical scale calibration.
      </Copy>
      <Choices<Scene>
        label="Scene"
        value={draft.scene}
        options={[
          { value: "packaging", label: "Packaging" },
          { value: "poster", label: "Poster" },
          { value: "card", label: "Card" },
        ]}
        onChange={(scene) => patch({ scene, photo: null })}
      />
      <Button
        title={draft.photo ? "Choose another photo" : "Use my photo"}
        secondary
        onPress={pick}
      />
      <Card>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 12 }}>
          <Text
            style={{
              fontSize: 48,
              fontWeight: "700",
              letterSpacing: -2,
              color: t.ink,
            }}
          >
            {report.score}
            <Text style={{ fontSize: 18, fontWeight: "400" }}> / 100</Text>
          </Text>
          <Copy muted size={12}>
            Print checklist
          </Copy>
        </View>
        {report.checks.map((c) => (
          <View key={c.id} style={{ gap: 3 }}>
            <Text
              style={{
                fontWeight: "600",
                fontSize: 14,
                color: c.passed ? t.ink : t.error,
              }}
            >
              {c.passed ? "✓" : "○"} {c.title}
            </Text>
            <Copy muted size={12}>
              {c.detail}
            </Copy>
          </View>
        ))}
        <Button title="Repair scanability" onPress={fix} />
        <Copy muted size={12}>
          Two size-planning checks, not a scan probability or an ISO grade.
          Always test a sample on the intended material.
        </Copy>
      </Card>
      <Card>
        <Range
          label="Printed width"
          value={draft.sizeMm}
          min={10}
          max={Math.max(150, draft.sizeMm)}
          unit="mm"
          onChange={(sizeMm) => patch({ sizeMm })}
        />
        <Range
          label="Viewing distance"
          value={draft.distanceCm}
          min={10}
          max={200}
          unit="cm"
          onChange={(distanceCm) => patch({ distanceCm })}
        />
        <Range
          label="Scene rotation"
          value={draft.rotation}
          min={-45}
          max={45}
          unit="°"
          onChange={(rotation) => patch({ rotation })}
        />
        <Range
          label="Scan strength"
          value={draft.strength * 100}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => patch({ strength: v / 100 })}
        />
        <Copy muted size={12}>
          The image keeps a four-module clear border. The checklist covers size
          and distance; the separate image decode is essential.
        </Copy>
      </Card>
      <Card>
        <Copy>Read-back check</Copy>
        <View style={{ alignItems: "center" }}>
          {generated.matrix && generated.png ? (
            <Symbol
              ref={ref}
              matrix={generated.matrix}
              artwork={generated.png}
              appearance={draft.appearance}
              size={140}
            />
          ) : null}
        </View>
        <Copy muted size={13}>
          {verification?.key === key
            ? verification.message
            : "Check that the rendered QR contains exactly what you entered. Scene glare and blur are not simulated in this mobile build."}
        </Copy>
        <Button
          title={
            busy
              ? "Reading QR…"
              : verified
                ? "Run read-back again"
                : "Check rendered QR"
          }
          onPress={check}
          disabled={busy || !generated.svg}
        />
        <Button
          title="Check a printed QR with camera"
          secondary
          disabled={!generated.svg}
          onPress={() => router.push("/camera")}
        />
      </Card>
      {error ? (
        <Text accessibilityRole="alert" style={{ color: t.error }}>
          {error}
        </Text>
      ) : null}
      <Button
        title="Continue to export →"
        onPress={() => router.push("/export")}
        disabled={!generated.svg}
      />
    </Page>
  );
}
