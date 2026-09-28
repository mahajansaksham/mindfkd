"use client";
import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import Script from "next/script";
import { api, Player, profileUrl } from "../lib/api";
import Modal from "./Modal";
type Identity = {
  initialize: (options: {
    client_id: string;
    nonce: string;
    callback: (response: { credential: string }) => void;
  }) => void;
  renderButton: (
    element: HTMLElement,
    options: Record<string, unknown>,
  ) => void;
  disableAutoSelect: () => void;
};
declare global {
  interface Window {
    google?: { accounts: { id: Identity } };
  }
}
type Auth = {
  player: Player | null;
  openAccount: () => void;
  refresh: () => Promise<void>;
};
const Context = createContext<Auth>({
  player: null,
  openAccount: () => {},
  refresh: async () => {},
});
export const useAccount = () => useContext(Context);
export function AccountProvider({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState<Player | null>(null),
    [clientId, setClientId] = useState<string | null>(null),
    [open, setOpen] = useState(false),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const result = await api<{
        player: Player | null;
        googleClientId: string | null;
      }>("/api/me");
      setPlayer(result.player);
      setClientId(result.googleClientId);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    const id = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(id);
  }, [refresh]);
  async function signedIn(credential: string) {
    try {
      const value = await api<{ player: Player }>("/api/auth/google", {
        credential,
      });
      setPlayer(value.player);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Context.Provider
      value={{ player, openAccount: () => setOpen(true), refresh }}
    >
      {children}
      {open && (
        <Modal
          title={player ? "Your player profile" : "Join the competition"}
          onClose={() => setOpen(false)}
        >
          {error && <p role="alert">{error}</p>}
          {player ? (
            <>
              <ProfileEditor
                player={player}
                onSaved={(p) => {
                  setPlayer(p);
                  setOpen(false);
                }}
              />
              {player.username && (
                <p>
                  <a className="text-link" href={profileUrl(player.username)}>
                    View your public profile ↗
                  </a>
                </p>
              )}
              <button
                className="share"
                onClick={async () => {
                  try {
                    await api("/api/auth/logout", {});
                    setPlayer(null);
                    window.google?.accounts.id.disableAutoSelect();
                    setOpen(false);
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                SIGN OUT
              </button>
            </>
          ) : (
            <>
              <p>
                Save ranked scores, choose a username and follow friends. You
                can always play as a guest.
              </p>
              {clientId ? (
                <GoogleButton clientId={clientId} onCredential={signedIn} />
              ) : (
                <p>
                  Google sign-in is not available yet. Please try again later.
                </p>
              )}
              <p className="muted">
                Your chosen name, username, bio, verified scores and follows are
                public. Your email is never displayed.{" "}
                <a href="/privacy">Privacy details</a>
              </p>
            </>
          )}
        </Modal>
      )}
    </Context.Provider>
  );
}
function GoogleButton({
  clientId,
  onCredential,
}: {
  clientId: string;
  onCredential: (credential: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null),
    [error, setError] = useState("");
  const initialized = useRef(false);
  const callback = useRef(onCredential);
  useEffect(() => {
    callback.current = onCredential;
  }, [onCredential]);
  const render = useCallback(async () => {
    if (!ref.current || !window.google || initialized.current) return;
    initialized.current = true;
    try {
      const { nonce } = await api<{ nonce: string }>("/api/auth/nonce", {});
      window.google.accounts.id.initialize({
        client_id: clientId,
        nonce,
        callback: (r) => callback.current(r.credential),
      });
      if (ref.current)
        window.google.accounts.id.renderButton(ref.current, {
          theme: "outline",
          size: "large",
          text: "continue_with",
          width: 280,
        });
    } catch (e) {
      initialized.current = false;
      setError((e as Error).message);
    }
  }, [clientId]);
  useEffect(() => {
    const id = setTimeout(() => void render(), 0);
    return () => clearTimeout(id);
  }, [render]);
  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        onLoad={render}
        onError={() =>
          setError(
            "Could not load Google sign-in. Check your connection or content blocker.",
          )
        }
      />
      <div ref={ref} className="google-button" />
      {error && <p role="alert">{error}</p>}
    </>
  );
}
function ProfileEditor({
  player,
  onSaved,
}: {
  player: Player;
  onSaved: (p: Player) => void;
}) {
  const [username, setUsername] = useState(player.username ?? ""),
    [name, setName] = useState(
      player.displayName === "Player" ? "" : player.displayName,
    ),
    [bio, setBio] = useState(player.bio),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="profile-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          const result = await api<{ player: Player }>("/api/profile", {
            username,
            displayName: name,
            bio,
          });
          onSaved(result.player);
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p>
        Your profile and ranked results are public. Choose the name friends will
        see.
      </p>
      <label>
        USERNAME
        <input
          required
          pattern="[a-zA-Z0-9_]{3,20}"
          minLength={3}
          maxLength={20}
          value={username}
          disabled={!!player.username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          autoComplete="username"
        />
      </label>
      <small>Usernames are permanent so shared links keep working.</small>
      <label>
        DISPLAY NAME
        <input
          required
          maxLength={32}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="nickname"
        />
      </label>
      <label>
        BIO <span>OPTIONAL</span>
        <textarea
          maxLength={160}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <button className="primary submit" disabled={busy}>
        {busy
          ? "SAVING…"
          : player.username
            ? "SAVE PROFILE"
            : "CREATE PUBLIC PROFILE"}
      </button>
    </form>
  );
}
