import { useCallback, useRef, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import type { ContentType } from "../../shared/qr";
import type { LibraryListing, LibraryRow } from "../src/local-library-core";
import { LibraryError } from "../src/local-library-model";
import { useDraft } from "../src/draft";
import { LibraryTitleDialog } from "../src/library-title-dialog";
import { refreshAfterOperationFailure } from "../src/library-screen-lifecycle";
import { Button, Card, Copy, Heading, Page, useTheme } from "../src/ui";

const typeLabels: Record<ContentType, string> = {
  url: "Website",
  text: "Text",
  phone: "Phone call",
  sms: "SMS",
  email: "Email",
  whatsapp: "WhatsApp",
  location: "Coordinates",
  event: "Calendar event",
  wifi: "Wi-Fi",
  vcard: "Contact",
};

function errorDetails(error: unknown) {
  return error instanceof LibraryError
    ? { code: error.code, message: error.message }
    : {
        code: "storage",
        message: "Device storage could not be accessed. Try again.",
      };
}

export default function LibraryScreen() {
  const {
      hasUnsavedChanges,
      libraryBusy,
      localLibrarySupported,
      listSaved,
      openSaved,
      renameSaved,
      deleteSaved,
      resetSavedLibrary,
    } = useDraft(),
    router = useRouter(),
    t = useTheme();
  const mounted = useRef(true);
  const listAction = useRef(listSaved);
  listAction.current = listSaved;
  const [listing, setListing] = useState<LibraryListing | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(
    null,
  );
  const [renameTarget, setRenameTarget] = useState<
    Extract<LibraryRow, { status: "saved" }> | undefined
  >();
  const [renameError, setRenameError] = useState("");
  const [resetPending, setResetPending] = useState(false);

  const refresh = useCallback(async () => {
    if (!mounted.current) return;
    setError(null);
    try {
      const next = await listAction.current();
      if (mounted.current && next) setListing(next);
    } catch (e) {
      if (mounted.current) setError(errorDetails(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      mounted.current = true;
      if (localLibrarySupported) void refresh();
      return () => {
        mounted.current = false;
      };
    }, [localLibrarySupported, refresh]),
  );

  async function performOpen(id: string, recoverPrevious = false) {
    setError(null);
    try {
      await openSaved(id, recoverPrevious, () => mounted.current);
      if (!mounted.current) return;
      router.replace("/");
      if (recoverPrevious)
        Alert.alert(
          "Recovered as an unsaved copy",
          "Review the design, then use Save on this device to create a new save.",
        );
    } catch (e) {
      if (mounted.current) setError(errorDetails(e));
    }
  }

  function requestOpen(id: string, recoverPrevious = false) {
    if (!hasUnsavedChanges) {
      void performOpen(id, recoverPrevious);
      return;
    }
    Alert.alert(
      "Discard unsaved changes?",
      "Opening this design will replace the draft you are editing.",
      [
        { text: "Keep editing", style: "cancel" },
        {
          text: "Discard and open",
          style: "destructive",
          onPress: () => void performOpen(id, recoverPrevious),
        },
      ],
    );
  }

  function confirmDelete(row: LibraryRow) {
    Alert.alert(
      "Delete this local save?",
      row.status === "saved"
        ? `“${row.title}” will be removed from this device. This cannot be undone.`
        : "The saved files for this item will be removed from this device. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setError(null);
            void deleteSaved(row.id)
              .then(refresh)
              .catch((e) => {
                const operationError = errorDetails(e);
                void refreshAfterOperationFailure(
                  operationError,
                  () => listAction.current(),
                  () => mounted.current,
                  (next) => {
                    if (next) setListing(next);
                  },
                  setError,
                  errorDetails,
                );
              });
          },
        },
      ],
    );
  }

  function showSavedActions(row: Extract<LibraryRow, { status: "saved" }>) {
    const rename = () => {
      setRenameError("");
      setRenameTarget(row);
    };
    const remove = () => confirmDelete(row);
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: row.title,
          options: ["Cancel", "Rename", "Delete"],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 2,
        },
        (index) => {
          if (index === 1) rename();
          if (index === 2) remove();
        },
      );
      return;
    }
    Alert.alert(row.title, undefined, [
      { text: "Rename", onPress: rename },
      { text: "Delete", style: "destructive", onPress: remove },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function showProblemActions(
    row: Exclude<LibraryRow, { status: "saved" }>,
  ) {
    const buttons: Parameters<typeof Alert.alert>[2] = [];
    if (row.status === "damaged" && row.recovery)
      buttons?.push({
        text: "Recover older copy",
        onPress: () => requestOpen(row.id, true),
      });
    if (row.status !== "unsupported")
      buttons?.push({
        text: row.status === "deleting" ? "Retry deletion" : "Delete files",
        style: "destructive",
        onPress: () => confirmDelete(row),
      });
    buttons?.push({ text: "Cancel", style: "cancel" });
    Alert.alert("Saved design options", row.message, buttons);
  }

  function confirmReset() {
    Alert.alert(
      "Delete inaccessible local saves?",
      "The encryption key is unavailable. This removes every local save and cannot recover their contents.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete all local saves",
          style: "destructive",
          onPress: () => {
            setError(null);
            setResetPending(true);
            void resetSavedLibrary()
              .then(() => {
                if (mounted.current) setResetPending(false);
                return refresh();
              })
              .catch((e) => {
                if (mounted.current) setError(errorDetails(e));
              });
          },
        },
      ],
    );
  }

  if (!localLibrarySupported)
    return (
      <Page>
        <Heading
          step="PRIVATE LIBRARY"
          title="Saved on your device."
          description="Private device saves are available in the Android and iOS apps."
        />
        <Card>
          <Copy>
            You can still edit and export in this web preview. Open the Android
            or iOS app to keep a private device library.
          </Copy>
          <Button
            title="Account & cloud workspace"
            secondary
            onPress={() => router.push("/workspace")}
          />
          <Button title="Return to Create" onPress={() => router.back()} />
        </Card>
      </Page>
    );

  return (
    <Page>
      <Heading
        step="PRIVATE LIBRARY"
        title="Your saved designs."
        description="Encrypted saves on this device, opened only when you choose."
      />
      <Copy muted size={12}>
        Titles, destination types and save times appear here. QR contents,
        passwords, contact details and private image thumbnails stay out of the
        list.
      </Copy>

      {error || resetPending ? (
        <Card>
          <Text accessibilityRole="alert" style={{ color: t.error }}>
            {error?.message || "The old private storage key still needs cleanup."}
          </Text>
          {!resetPending ? (
            <Button
              title="Retry"
              secondary
              disabled={!!libraryBusy}
              onPress={() => void refresh()}
            />
          ) : null}
          {error?.code === "key-missing" || resetPending ? (
            <Button
              title={
                resetPending
                  ? "Retry local save cleanup"
                  : "Delete inaccessible local saves"
              }
              secondary
              disabled={!!libraryBusy}
              onPress={confirmReset}
            />
          ) : null}
        </Card>
      ) : null}

      {listing?.issues.map((issue) => (
        <Text key={issue} accessibilityRole="alert" style={{ color: t.error }}>
          {issue}
        </Text>
      ))}

      {listing && listing.rows.length === 0 && !error ? (
        <Card>
          <Text
            accessibilityRole="header"
            style={{ color: t.ink, fontSize: 20, fontWeight: "700" }}
          >
            No saved designs yet
          </Text>
          <Copy muted>
            Use Save on this device from Create. Nothing is saved automatically.
          </Copy>
          <Button title="Create a design" onPress={() => router.replace("/")} />
        </Card>
      ) : null}

      {listing?.rows.map((row) => {
        if (row.status !== "saved")
          return (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              accessibilityLabel={`${row.status} saved design. Show options.`}
              disabled={!!libraryBusy}
              onPress={() => showProblemActions(row)}
              style={({ pressed }) => ({
                minHeight: 76,
                padding: 16,
                gap: 6,
                borderRadius: 17,
                borderWidth: 1,
                borderColor: row.status === "unsupported" ? t.line : t.error,
                backgroundColor: pressed ? t.panelRaised : t.panel,
                opacity: libraryBusy ? 0.5 : 1,
              })}
            >
              <Text style={{ color: t.ink, fontSize: 16, fontWeight: "700" }}>
                {row.status === "damaged"
                  ? "Damaged save"
                  : row.status === "deleting"
                    ? "Deletion needs attention"
                    : "Newer app required"}
              </Text>
              <Copy muted size={12}>
                {row.message}
                {row.recovery
                  ? ` Older copy saved ${new Date(row.recovery.updatedAt).toLocaleString()}.`
                  : ""}
              </Copy>
            </Pressable>
          );
        return (
          <View
            key={row.id}
            style={{
              minHeight: 82,
              flexDirection: "row",
              alignItems: "center",
              borderRadius: 17,
              borderWidth: 1,
              borderColor: t.line,
              backgroundColor: t.panel,
              overflow: "hidden",
              opacity: libraryBusy ? 0.5 : 1,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${row.title}, ${typeLabels[row.type]}`}
              disabled={!!libraryBusy}
              onPress={() => requestOpen(row.id)}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 82,
                flexDirection: "row",
                alignItems: "center",
                gap: 13,
                paddingHorizontal: 15,
                paddingVertical: 12,
                backgroundColor: pressed ? t.panelRaised : "transparent",
              })}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: t.line,
                  backgroundColor: t.panelRaised,
                }}
              >
                <Text style={{ color: t.accent, fontSize: 21 }}>⌁</Text>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text
                  numberOfLines={1}
                  style={{ color: t.ink, fontSize: 16, fontWeight: "700" }}
                >
                  {row.title}
                </Text>
                <Text style={{ color: t.muted, fontSize: 12 }}>
                  Saved · {typeLabels[row.type]} · {new Date(row.updatedAt).toLocaleString()}
                </Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`More options for ${row.title}`}
              disabled={!!libraryBusy}
              onPress={() => showSavedActions(row)}
              style={({ pressed }) => ({
                minWidth: 52,
                minHeight: 52,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 14,
                marginRight: 8,
                backgroundColor: pressed ? t.panelRaised : "transparent",
              })}
            >
              <Text style={{ color: t.ink, fontSize: 24, lineHeight: 24 }}>⋯</Text>
            </Pressable>
          </View>
        );
      })}

      {libraryBusy ? (
        <Text accessibilityRole="alert" style={{ color: t.muted }}>
          {libraryBusy}
        </Text>
      ) : null}

      <Button
        title="Account & cloud workspace"
        secondary
        onPress={() => router.push("/workspace")}
      />

      <LibraryTitleDialog
        visible={!!renameTarget}
        heading="Rename saved design"
        initialValue={renameTarget?.title || ""}
        busy={!!libraryBusy}
        errorMessage={renameError}
        onCancel={() => {
          if (!libraryBusy) {
            setRenameTarget(undefined);
            setRenameError("");
          }
        }}
        onSave={(title) => {
          if (!renameTarget) return;
          setError(null);
          setRenameError("");
          void renameSaved(renameTarget.id, title, renameTarget.generation)
            .then(() => {
              if (mounted.current) setRenameTarget(undefined);
              return refresh();
            })
            .catch((e) => {
              if (mounted.current) setRenameError(errorDetails(e).message);
            });
        }}
      />
    </Page>
  );
}
