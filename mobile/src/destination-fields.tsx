import { Platform, Switch, Text, View } from "react-native";
import type { Content } from "../../shared/qr";
import { Choices, Copy, Field, useTheme } from "./ui";
import {
  visibleWifiEncryption,
  withWifiEncryption,
  type WifiEncryption,
} from "./destination-options";

type Props = {
  content: Content;
  onChange: (change: Partial<Content>) => void;
};

const machine = {
  autoCapitalize: "none" as const,
  autoCorrect: false,
};

export function DestinationFields({ content, onChange }: Props) {
  const t = useTheme();
  if (content.type === "url")
    return (
      <Field
        label="Website address"
        value={content.url}
        onChangeText={(url) => onChange({ url })}
        keyboardType="url"
        maxLength={1200}
        {...machine}
      />
    );
  if (content.type === "text")
    return (
      <Field
        label="Text"
        value={content.text || ""}
        onChangeText={(text) => onChange({ text })}
        multiline
        maxLength={1200}
      />
    );
  if (content.type === "phone")
    return (
      <Field
        label="Phone number"
        value={content.phone}
        onChangeText={(phone) => onChange({ phone })}
        keyboardType="phone-pad"
        maxLength={80}
        {...machine}
      />
    );
  if (content.type === "sms")
    return (
      <>
        <Field
          label="SMS phone number"
          value={content.phone}
          onChangeText={(phone) => onChange({ phone })}
          keyboardType="phone-pad"
          maxLength={80}
          {...machine}
        />
        <Field
          label="Message (optional)"
          value={content.smsMessage || ""}
          onChangeText={(smsMessage) => onChange({ smsMessage })}
          multiline
          maxLength={1200}
        />
      </>
    );
  if (content.type === "email")
    return (
      <>
        <Field
          label="Email address"
          value={content.email}
          onChangeText={(email) => onChange({ email })}
          keyboardType="email-address"
          maxLength={320}
          {...machine}
        />
        <Field
          label="Subject (optional)"
          value={content.emailSubject || ""}
          onChangeText={(emailSubject) => onChange({ emailSubject })}
          maxLength={1200}
        />
        <Field
          label="Message (optional)"
          value={content.emailBody || ""}
          onChangeText={(emailBody) => onChange({ emailBody })}
          multiline
          maxLength={1200}
        />
      </>
    );
  if (content.type === "whatsapp")
    return (
      <>
        <Field
          label="International phone number"
          value={content.phone}
          onChangeText={(phone) => onChange({ phone })}
          keyboardType="phone-pad"
          placeholder="+61 412 345 678"
          maxLength={80}
          {...machine}
        />
        <Field
          label="Message (optional)"
          value={content.whatsappMessage || ""}
          onChangeText={(whatsappMessage) => onChange({ whatsappMessage })}
          multiline
          maxLength={1200}
        />
      </>
    );
  if (content.type === "location") {
    const signedKeyboard =
      Platform.OS === "ios" ? "numbers-and-punctuation" : "numeric";
    return (
      <>
        <Field
          label="Latitude"
          value={content.latitude || ""}
          onChangeText={(latitude) => onChange({ latitude })}
          keyboardType={signedKeyboard}
          placeholder="-33.8688"
          maxLength={40}
          {...machine}
        />
        <Field
          label="Longitude"
          value={content.longitude || ""}
          onChangeText={(longitude) => onChange({ longitude })}
          keyboardType={signedKeyboard}
          placeholder="151.2093"
          maxLength={40}
          {...machine}
        />
      </>
    );
  }
  if (content.type === "event")
    return (
      <>
        <Field
          label="Event title"
          value={content.eventTitle || ""}
          onChangeText={(eventTitle) => onChange({ eventTitle })}
          maxLength={300}
        />
        <Field
          label="Starts — YYYY-MM-DDTHH:mm"
          value={content.eventStart || ""}
          onChangeText={(eventStart) => onChange({ eventStart })}
          placeholder="2026-10-02T18:30"
          maxLength={19}
          {...machine}
        />
        <Field
          label="Ends — YYYY-MM-DDTHH:mm"
          value={content.eventEnd || ""}
          onChangeText={(eventEnd) => onChange({ eventEnd })}
          placeholder="2026-10-02T20:00"
          maxLength={19}
          {...machine}
        />
        <Field
          label="IANA timezone (optional)"
          value={content.eventTimezone || ""}
          onChangeText={(eventTimezone) => onChange({ eventTimezone })}
          placeholder="Australia/Sydney"
          maxLength={120}
          {...machine}
        />
        <Copy muted size={12}>
          Leave timezone blank for floating local time. A timezone labels these
          local date and time values; it does not convert them or resolve daylight
          saving ambiguity.
        </Copy>
        <Field
          label="Location (optional)"
          value={content.eventLocation || ""}
          onChangeText={(eventLocation) => onChange({ eventLocation })}
          maxLength={500}
        />
        <Field
          label="Description (optional)"
          value={content.eventDescription || ""}
          onChangeText={(eventDescription) => onChange({ eventDescription })}
          multiline
          maxLength={1200}
        />
      </>
    );
  if (content.type === "wifi") {
    const encryption = visibleWifiEncryption(content);
    return (
      <>
        <Field
          label="Network name"
          value={content.ssid}
          onChangeText={(ssid) => onChange({ ssid })}
          maxLength={1200}
          {...machine}
        />
        <Choices<WifiEncryption>
          label="Wi-Fi security"
          value={encryption}
          options={[
            { value: "WPA", label: "WPA" },
            { value: "WEP", label: "WEP" },
            { value: "nopass", label: "Open" },
          ]}
          onChange={(next) => onChange(withWifiEncryption(content, next))}
        />
        {encryption !== "nopass" ? (
          <Field
            label="Wi-Fi password"
            value={content.password}
            onChangeText={(password) => onChange({ password })}
            secureTextEntry
            maxLength={1200}
            {...machine}
          />
        ) : null}
        <View
          style={{
            minHeight: 48,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <Text style={{ color: t.ink, fontSize: 13, fontWeight: "600" }}>
            Hidden network
          </Text>
          <Switch
            accessibilityLabel="Hidden network"
            value={!!content.wifiHidden}
            onValueChange={(wifiHidden) => onChange({ wifiHidden })}
            trackColor={{ false: t.line, true: t.accent }}
          />
        </View>
        <Copy muted size={12}>
          A Wi-Fi QR contains its password in readable form. Anyone who scans it
          can retrieve it.
        </Copy>
      </>
    );
  }
  return (
    <>
      <Field
        label="Full name"
        value={content.name}
        onChangeText={(name) => onChange({ name })}
        maxLength={300}
      />
      <Field
        label="Phone (optional)"
        value={content.phone}
        onChangeText={(phone) => onChange({ phone })}
        keyboardType="phone-pad"
        maxLength={80}
        {...machine}
      />
      <Field
        label="Email (optional)"
        value={content.email}
        onChangeText={(email) => onChange({ email })}
        keyboardType="email-address"
        maxLength={320}
        {...machine}
      />
      <Field
        label="Company (optional)"
        value={content.company || ""}
        onChangeText={(company) => onChange({ company })}
        maxLength={300}
      />
      <Field
        label="Job title (optional)"
        value={content.title || ""}
        onChangeText={(title) => onChange({ title })}
        maxLength={300}
      />
      <Field
        label="Website (optional)"
        value={content.website || ""}
        onChangeText={(website) => onChange({ website })}
        keyboardType="url"
        maxLength={1200}
        {...machine}
      />
      <Field
        label="Address (optional)"
        value={content.address || ""}
        onChangeText={(address) => onChange({ address })}
        multiline
        maxLength={1200}
      />
    </>
  );
}
