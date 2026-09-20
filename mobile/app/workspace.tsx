import { useEffect, useRef, useState } from "react";
import { Text } from "react-native";
import { useRouter } from "expo-router";
import { Button, Card, Copy, Heading, Page, useTheme } from "../src/ui";
import {
  openWorkspaceTarget,
  type WorkspaceTarget,
} from "../src/workspace-links";
import { openWorkspaceUrl } from "../src/workspace-opener";

const actions: ReadonlyArray<{ target: WorkspaceTarget; label: string }> = [
  { target: "account", label: "Account — open in browser" },
  { target: "designs", label: "Cloud designs — open in browser" },
  { target: "links", label: "Dynamic links — open in browser" },
  { target: "content", label: "Hosted content — open in browser" },
];

export default function WorkspaceScreen() {
  const router = useRouter(),
    t = useTheme();
  const mounted = useRef(true);
  const [busy, setBusy] = useState<WorkspaceTarget | null>(null);
  const [message, setMessage] = useState("");

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  async function open(target: WorkspaceTarget) {
    setBusy(target);
    setMessage("");
    try {
      await openWorkspaceTarget(target, openWorkspaceUrl);
      if (mounted.current)
        setMessage("Opened in your browser. Your local draft remains here.");
    } catch (error) {
      if (mounted.current) {
        const reason =
          error instanceof Error
            ? error.message
            : "The browser could not be opened.";
        setMessage(`${reason} Your local draft remains here. Try again.`);
      }
    } finally {
      if (mounted.current) setBusy(null);
    }
  }

  return (
    <Page>
      <Heading
        step="WEB WORKSPACE"
        title="Account & cloud workspace"
        description="Opens qrupgrade.com in your browser. Sign in there to manage your account and online work. Your local app draft is not sent."
      />
      <Card>
        <Copy muted size={13}>
          Your browser session belongs to the website and may already be signed
          in. Returning to this app keeps the draft you were editing.
        </Copy>
        {actions.map((action) => (
          <Button
            key={action.target}
            title={
              busy === action.target ? "Opening browser…" : action.label
            }
            secondary
            disabled={busy !== null}
            onPress={() => void open(action.target)}
          />
        ))}
      </Card>
      {message ? (
        <Text accessibilityRole="alert" style={{ color: t.ink, lineHeight: 22 }}>
          {message}
        </Text>
      ) : null}
      <Button title="Back to studio" onPress={() => router.back()} />
    </Page>
  );
}
