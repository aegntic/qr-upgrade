import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TextInputProps,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Slider from "./range-input";
export function useTheme() {
  const dark = useColorScheme() === "dark";
  return {
    dark,
    bg: dark ? "#080b10" : "#f1f4f7",
    panel: dark ? "#121821" : "#ffffff",
    panelRaised: dark ? "#19212c" : "#f8fafc",
    ink: dark ? "#f4f7fa" : "#17202a",
    muted: dark ? "#9ba8b7" : "#5d6977",
    line: dark ? "#2c3744" : "#d4dbe3",
    accent: dark ? "#a9c7e3" : "#8db5d8",
    accentInk: "#0b121a",
    error: dark ? "#ffaaa5" : "#a23f3b",
    success: dark ? "#8bd8ba" : "#247356",
  };
}
export function Page({ children }: { children: React.ReactNode }) {
  const t = useTheme(),
    insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 20,
          paddingBottom: Math.max(28, insets.bottom + 18),
          gap: 22,
          width: "100%",
          maxWidth: 680,
          alignSelf: "center",
        }}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
export function Copy({
  children,
  muted = false,
  size = 15,
}: {
  children: React.ReactNode;
  muted?: boolean;
  size?: number;
}) {
  const t = useTheme();
  return (
    <Text
      style={{
        color: muted ? t.muted : t.ink,
        fontSize: size,
        lineHeight: size * 1.5,
      }}
    >
      {children}
    </Text>
  );
}
export function Heading({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text
        style={{
          fontSize: 11,
          fontWeight: "700",
          letterSpacing: 2,
          color: t.muted,
        }}
      >
        {step}
      </Text>
      <Text
        accessibilityRole="header"
        style={{
          fontSize: 34,
          fontWeight: "700",
          letterSpacing: -1.5,
          color: t.ink,
        }}
      >
        {title}
      </Text>
      <Copy muted>{description}</Copy>
    </View>
  );
}
export function Card({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: t.panel,
        borderColor: t.line,
        borderWidth: 1,
        borderRadius: 20,
        padding: 18,
        gap: 16,
      }}
    >
      {children}
    </View>
  );
}
export function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 52,
        borderRadius: 14,
        justifyContent: "center",
        alignItems: "center",
        padding: 14,
        backgroundColor: secondary ? (pressed ? t.panelRaised : t.panel) : t.accent,
        borderWidth: secondary ? 1 : 0,
        borderColor: t.line,
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={{
          fontWeight: "700",
          fontSize: 15,
          color: secondary ? t.ink : t.accentInk,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 7 }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: t.ink }}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={t.muted}
        {...props}
        style={{
          borderWidth: 1,
          borderColor: t.line,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 13,
          minHeight: 48,
          color: t.ink,
          fontSize: 16,
          backgroundColor: t.bg,
        }}
      />
    </View>
  );
}
export function Choices<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Copy size={13}>{label}</Copy>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
        {options.map((o) => (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${o.label}`}
            accessibilityState={{ selected: value === o.value }}
            onPress={() => onChange(o.value)}
            style={{
              borderRadius: 10,
              minHeight: 46,
              paddingHorizontal: 15,
              justifyContent: "center",
              backgroundColor: value === o.value ? t.ink : t.bg,
              borderWidth: 1,
              borderColor: t.line,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: value === o.value ? t.bg : t.ink,
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export function Range({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  const t = useTheme();
  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Copy size={13}>{label}</Copy>
        <Copy size={13}>
          {Math.round(value)} {unit}
        </Copy>
      </View>
      <Slider
        accessibilityLabel={label}
        accessibilityValue={{
          min,
          max,
          now: value,
          text: `${Math.round(value)} ${unit}`,
        }}
        minimumValue={min}
        maximumValue={max}
        value={value}
        step={1}
        onValueChange={onChange}
        minimumTrackTintColor={t.ink}
        maximumTrackTintColor={t.line}
        thumbTintColor={t.ink}
        style={{ height: 44, width: "100%" }}
      />
    </View>
  );
}
