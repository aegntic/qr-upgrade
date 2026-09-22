import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTheme } from "./ui";

export function LibraryTitleDialog({
  visible,
  heading,
  initialValue,
  busy,
  errorMessage = "",
  onCancel,
  onSave,
}: {
  visible: boolean;
  heading: string;
  initialValue: string;
  busy: boolean;
  errorMessage?: string;
  onCancel: () => void;
  onSave: (title: string) => void;
}) {
  const t = useTheme();
  const [title, setTitle] = useState(initialValue);
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (!visible) return;
    setTitle(initialValue);
    setValidationError("");
  }, [initialValue, visible]);

  function submit() {
    const clean = title.trim();
    if (!clean || clean.length > 80 || /[\u0000-\u001f\u007f]/.test(clean)) {
      setValidationError("Enter a title from 1 to 80 characters.");
      return;
    }
    onSave(clean);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, justifyContent: "center", padding: 20 }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel title editing"
          onPress={busy ? undefined : onCancel}
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(2, 5, 9, 0.72)",
          }}
        />
        <View
          accessibilityViewIsModal
          style={{
            width: "100%",
            maxWidth: 480,
            alignSelf: "center",
            gap: 18,
            padding: 20,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: t.line,
            backgroundColor: t.panelRaised,
          }}
        >
          <Text
            accessibilityRole="header"
            style={{ color: t.ink, fontSize: 23, fontWeight: "700" }}
          >
            {heading}
          </Text>
          <View style={{ gap: 7 }}>
            <Text style={{ color: t.ink, fontSize: 13, fontWeight: "600" }}>
              Design title
            </Text>
            <TextInput
              accessibilityLabel="Design title"
              autoFocus
              selectTextOnFocus
              value={title}
              onChangeText={(value) => {
                setTitle(value);
                setValidationError("");
              }}
              onSubmitEditing={submit}
              returnKeyType="done"
              maxLength={80}
              editable={!busy}
              style={{
                minHeight: 50,
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: validationError || errorMessage ? t.error : t.line,
                backgroundColor: t.bg,
                color: t.ink,
                fontSize: 17,
              }}
            />
            {validationError || errorMessage ? (
              <Text accessibilityRole="alert" style={{ color: t.error }}>
                {validationError || errorMessage}
              </Text>
            ) : null}
          </View>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10 }}>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={onCancel}
              style={({ pressed }) => ({
                minHeight: 48,
                minWidth: 90,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 12,
                borderWidth: 1,
                borderColor: t.line,
                opacity: busy ? 0.4 : pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ color: t.ink, fontWeight: "700" }}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={submit}
              style={({ pressed }) => ({
                minHeight: 48,
                minWidth: 90,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 12,
                backgroundColor: t.accent,
                opacity: busy ? 0.4 : pressed ? 0.75 : 1,
              })}
            >
              <Text style={{ color: t.accentInk, fontWeight: "700" }}>
                {busy ? "Saving…" : "Save"}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
