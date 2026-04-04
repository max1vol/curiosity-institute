export interface GoogleUserSession {
  provider: "google";
  sub: string;
  email: string;
  name: string;
  givenName: string;
  picture: string;
  lastSignedInAt: string;
}

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleIdClient {
  initialize(config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    context?: string;
    ux_mode?: "popup" | "redirect";
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      theme?: "outline" | "filled_black" | "filled_blue";
      size?: "large" | "medium" | "small";
      text?: "signin_with" | "signup_with" | "continue_with" | "signin";
      shape?: "rectangular" | "pill" | "circle" | "square";
      logo_alignment?: "left" | "center";
      width?: number;
    }
  ): void;
  disableAutoSelect(): void;
  revoke(email: string, callback: () => void): void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleIdClient;
      };
    };
  }
}

const GOOGLE_AUTH_STORAGE_KEY = "curiosity-institute-google-auth-v1";
let googleScriptPromise: Promise<void> | null = null;

function decodeJwtPayload(token: string): Record<string, unknown> {
  const payload = token.split(".")[1];

  if (!payload) {
    throw new Error("Invalid Google credential payload.");
  }

  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const decoded = atob(padded);
  const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  const text = new TextDecoder().decode(bytes);

  return JSON.parse(text) as Record<string, unknown>;
}

export function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google sign-in is only available in the browser."));
  }

  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Failed to load Google Identity Services.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity Services."));
    document.head.appendChild(script);
  });

  return googleScriptPromise;
}

export function sessionFromGoogleCredential(credential: string): GoogleUserSession {
  const payload = decodeJwtPayload(credential);

  if (typeof payload.sub !== "string" || typeof payload.email !== "string" || typeof payload.name !== "string") {
    throw new Error("Google credential is missing required profile fields.");
  }

  return {
    provider: "google",
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
    givenName: typeof payload.given_name === "string" ? payload.given_name : payload.name,
    picture: typeof payload.picture === "string" ? payload.picture : "",
    lastSignedInAt: new Date().toISOString()
  };
}

export function persistGoogleSession(session: GoogleUserSession): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(GOOGLE_AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function restoreGoogleSession(): GoogleUserSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(GOOGLE_AUTH_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<GoogleUserSession>;

    if (
      parsed.provider !== "google" ||
      typeof parsed.sub !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.name !== "string"
    ) {
      return null;
    }

    return {
      provider: "google",
      sub: parsed.sub,
      email: parsed.email,
      name: parsed.name,
      givenName: typeof parsed.givenName === "string" ? parsed.givenName : parsed.name,
      picture: typeof parsed.picture === "string" ? parsed.picture : "",
      lastSignedInAt: typeof parsed.lastSignedInAt === "string" ? parsed.lastSignedInAt : new Date().toISOString()
    };
  } catch {
    return null;
  }
}

export function clearGoogleSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(GOOGLE_AUTH_STORAGE_KEY);
}

export function saveSlotIdForGoogleSession(session: GoogleUserSession | null): string {
  return session ? `google:${session.sub}` : "guest";
}
