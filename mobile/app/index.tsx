import { useRef, useState, useEffect } from "react";
import * as ImagePicker from "expo-image-picker";
import { artworkDesigns } from "../../src/lib/artwork-designs";
import proofs from "../../src/lib/artwork-proofs.json";
import { artworkAssets } from "../src/artwork-assets";
import { useRouter } from "expo-router";
import { View, Text, Pressable, Image } from "react-native";
import { useDraft } from "../src/draft";
import { LibraryTitleDialog } from "../src/library-title-dialog";
import {
  Button,
  Card,
  Choices,
  Copy,
  Field,
  Heading,
  Page,
  Range,
  useTheme,
} from "../src/ui";
import { Symbol } from "../src/symbol";
export default function Create() {
  const {
      draft,
      content,
      appearance,
      patch,
      generated,
      reset,
      savedIdentity,
      hasUnsavedChanges,
      libraryBusy,
      localLibrarySupported,
      saveCurrent,
    } = useDraft(),
    router = useRouter(),
    t = useTheme();
  const [uploadError, setUploadError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [titleOpen, setTitleOpen] = useState(false);
  const sequence = useRef(0);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
      sequence.current++;
    },
    [],
  );
  async function chooseImage(kind: "artwork" | "portrait" = "artwork") {
    const request = ++sequence.current;
    setUploadError("");
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
      });
      if (result.canceled || request !== sequence.current) return;
      const asset = result.assets[0];
      if (
        (asset.fileSize || 0) > 8 * 1024 * 1024 ||
        asset.width * asset.height > 40000000
      )
        throw new Error("Choose an image below 8 MB and 40 megapixels.");
      if (kind === "portrait") patch({ portraitUri: asset.uri });
      else patch({ artwork: "custom", artworkUri: asset.uri, strength: 0.35 });
    } catch (e) {
      if (request === sequence.current)
        setUploadError(
          e instanceof Error ? e.message : "Image selection failed.",
        );
    }
  }
  async function save(title?: string) {
    setSaveMessage("");
    try {
      await saveCurrent(title);
      if (!mounted.current) return;
      setTitleOpen(false);
      setSaveMessage("Saved on this device.");
    } catch (e) {
      if (!mounted.current) return;
      setSaveMessage(
        e instanceof Error ? e.message : "This design could not be saved.",
      );
    }
  }
  const saveLabel = !localLibrarySupported
    ? "Private saves need the mobile app"
    : libraryBusy
      ? libraryBusy
      : savedIdentity
        ? hasUnsavedChanges
          ? "Save changes"
          : "Saved on this device"
        : "Save on this device";
  return (
    <Page>
      <View style={{ alignItems: "flex-end" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open saved design library"
          onPress={() => router.push("/library")}
          style={({ pressed }) => ({
            minHeight: 44,
            justifyContent: "center",
            paddingHorizontal: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: t.line,
            backgroundColor: pressed ? t.panelRaised : t.panel,
          })}
        >
          <Text style={{ color: t.ink, fontWeight: "700" }}>Library</Text>
        </Pressable>
      </View>
      <Heading
        step="01 / CREATE"
        title="Make your image the QR."
        description="Artwork and destination become one scannable image."
      />
      <Card>
        <View style={{ alignItems: "center", paddingVertical: 14, gap: 14 }}>
          {generated.matrix && generated.png ? (
            <Symbol
              matrix={generated.matrix}
              artwork={generated.png}
              appearance={draft.appearance}
            />
          ) : (
            <View style={{ height: 210, justifyContent: "center" }}>
              <Copy>Creating your QR artwork…</Copy>
            </View>
          )}
          <Text
            style={{
              fontSize: 11,
              fontWeight: "700",
              letterSpacing: 2,
              color: t.muted,
            }}
          >
            {draft.brand || "YOUR BRAND"}
          </Text>
        </View>
      </Card>
      <Card>
        <Copy size={13}>Private device library</Copy>
        <Button
          title={saveLabel}
          disabled={!!libraryBusy || (!!savedIdentity && !hasUnsavedChanges)}
          onPress={() => {
            if (!localLibrarySupported) {
              router.push("/library");
            } else if (savedIdentity) {
              void save();
            } else {
              setSaveMessage("");
              setTitleOpen(true);
            }
          }}
        />
        {saveMessage ? (
          <Text
            accessibilityRole={saveMessage.startsWith("Saved") ? "text" : "alert"}
            style={{
              color: saveMessage.startsWith("Saved") ? t.success : t.error,
            }}
          >
            {saveMessage}
          </Text>
        ) : null}
        <Copy muted size={12}>
          Saved designs stay in this app on this device. They can include Wi-Fi
          passwords and contact details. They are not a backup or a cloud save.
          Selected images are saved as normalized app copies, not full-resolution
          originals.
        </Copy>
      </Card>
      <Choices
        label="QR content"
        value={draft.content.type}
        options={[
          { value: "url", label: "Website" },
          { value: "wifi", label: "Wi-Fi" },
          { value: "vcard", label: "Contact" },
        ]}
        onChange={(type) => content({ type })}
      />
      <Card>
        {draft.content.type === "url" ? (
          <Field
            label="Website address"
            value={draft.content.url}
            onChangeText={(url) => content({ url })}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            maxLength={1200}
          />
        ) : draft.content.type === "wifi" ? (
          <>
            <Field
              label="Network name"
              value={draft.content.ssid}
              onChangeText={(ssid) => content({ ssid })}
              autoCapitalize="none"
              maxLength={100}
            />
            <Field
              label="Wi-Fi password"
              value={draft.content.password}
              onChangeText={(password) => content({ password })}
              secureTextEntry
              autoCapitalize="none"
              maxLength={200}
            />
            <Copy muted size={12}>
              Your password is encoded in the QR. Anyone who scans it can read
              it.
            </Copy>
          </>
        ) : (
          <>
            <Field
              label="Full name"
              value={draft.content.name}
              onChangeText={(name) => content({ name })}
              maxLength={100}
            />
            <Field
              label="Email"
              value={draft.content.email}
              onChangeText={(email) => content({ email })}
              keyboardType="email-address"
              autoCapitalize="none"
              maxLength={150}
            />
            <Field
              label="Phone"
              value={draft.content.phone}
              onChangeText={(phone) => content({ phone })}
              keyboardType="phone-pad"
              maxLength={40}
            />
          </>
        )}
        {generated.error ? (
          <Text accessibilityRole="alert" style={{ color: t.error }}>
            {generated.error}
          </Text>
        ) : null}
      </Card>
      <Card>
        <Field
          label="Brand name"
          value={draft.brand}
          onChangeText={(brand) => patch({ brand })}
          maxLength={30}
        />
        <Copy size={13}>Artwork direction</Copy>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {artworkDesigns.map((d) => (
            <Pressable
              key={d.id}
              accessibilityRole="button"
              accessibilityLabel={d.name}
              accessibilityState={{ selected: draft.artwork === d.id }}
              onPress={() =>
                patch({
                  artwork: d.id,
                  artworkUri: null,
                  strength: proofs[d.id].strength,
                })
              }
              style={{
                width: 76,
                padding: 4,
                borderRadius: 8,
                borderWidth: 2,
                borderColor: draft.artwork === d.id ? t.ink : t.line,
              }}
            >
              <Image
                source={artworkAssets[d.id]}
                style={{ width: 64, height: 64, borderRadius: 4 }}
              />
              <Text style={{ fontSize: 9, color: t.ink, marginTop: 4 }}>
                {d.name}
              </Text>
            </Pressable>
          ))}
        </View>
        <Button
          title="Use your own image"
          secondary
          onPress={() => void chooseImage()}
        />
        {uploadError ? (
          <Text accessibilityRole="alert" style={{ color: t.error }}>
            {uploadError}
          </Text>
        ) : null}
        <Range
          label="Scan strength"
          value={draft.strength * 100}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => patch({ strength: v / 100 })}
        />
        <Copy muted size={12}>
          Lower values preserve artwork detail. Raise strength if the image
          fails its scan check.
        </Copy>
      </Card>
      <Card>
        <Copy size={13}>Your profile, at the centre</Copy>
        <Button
          title={
            draft.portraitUri ? "Replace profile photo" : "Add profile photo"
          }
          secondary
          onPress={() => void chooseImage("portrait")}
        />
        {draft.portraitUri ? (
          <>
            <Range
              label="Portrait size"
              value={draft.portraitSize}
              min={10}
              max={24}
              unit="%"
              onChange={(portraitSize) => patch({ portraitSize })}
            />
            <Button
              title="Remove profile photo"
              secondary
              onPress={() => {
                sequence.current++;
                patch({ portraitUri: null });
              }}
            />
          </>
        ) : null}
        <Copy muted size={12}>
          Circular photo, brushed-metal surround. Your photo stays on this
          device and is included in the exported image. Test it in Scan Lab
          before downloading.
        </Copy>
      </Card>
      <Button
        title="Test in Scan Lab →"
        onPress={() => router.push("/test")}
        disabled={!generated.svg}
      />
      <Button
        title="Clear this draft"
        secondary
        disabled={!!libraryBusy}
        onPress={() => {
          sequence.current++;
          setUploadError("");
          setSaveMessage("");
          reset();
        }}
      />
      <Copy muted size={12}>
        No account needed. Your draft stays on this device and clears when the
        app restarts. Choose an AI-created example or your own image. Live
        text-to-image generation is not connected yet.
      </Copy>
      <LibraryTitleDialog
        visible={titleOpen}
        heading="Save on this device"
        initialValue={draft.brand === "Your Brand Here." ? "" : draft.brand}
        busy={!!libraryBusy}
        errorMessage={
          saveMessage && !saveMessage.startsWith("Saved") ? saveMessage : ""
        }
        onCancel={() => {
          if (!libraryBusy) setTitleOpen(false);
        }}
        onSave={(title) => void save(title)}
      />
    </Page>
  );
}
