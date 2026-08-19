const GRANT_LIFETIME_SECONDS = 2 * 60 * 60;
const GRANT_CONTEXT = "aer-whatsapp-media-upload/v1";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type GrantOptions = {
  nowSeconds?: number;
};

type GrantPayload = {
  version: 1;
  context: typeof GRANT_CONTEXT;
  sessionId: string;
  issuedAt: number;
  expiresAt: number;
};

function requireSigningSecret() {
  const secret = process.env.EVOLUTION_API_KEY?.trim();
  if (!secret) throw new Error("Envio de m\u00eddia n\u00e3o configurado.");
  return secret;
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("invalid base64url");
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmacKey() {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(`${GRANT_CONTEXT}\0${requireSigningSecret()}`),
  );
  return crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createUploadGrant(sessionId: string, options: GrantOptions = {}) {
  if (!UUID_PATTERN.test(sessionId)) throw new Error("Sess\u00e3o de envio inv\u00e1lida.");

  const issuedAt = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const payload: GrantPayload = {
    version: 1,
    context: GRANT_CONTEXT,
    sessionId,
    issuedAt,
    expiresAt: issuedAt + GRANT_LIFETIME_SECONDS,
  };
  const encodedPayload = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(),
    new TextEncoder().encode(encodedPayload),
  );

  return `${encodedPayload}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifyUploadGrant(grant: string, options: GrantOptions = {}) {
  try {
    const [encodedPayload, encodedSignature, extra] = grant.split(".");
    if (!encodedPayload || !encodedSignature || extra) throw new Error("invalid structure");

    const validSignature = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(),
      fromBase64Url(encodedSignature),
      new TextEncoder().encode(encodedPayload),
    );
    if (!validSignature) throw new Error("invalid signature");

    const payload = JSON.parse(
      new TextDecoder().decode(fromBase64Url(encodedPayload)),
    ) as Partial<GrantPayload>;
    if (
      payload.version !== 1 ||
      payload.context !== GRANT_CONTEXT ||
      !payload.sessionId ||
      !UUID_PATTERN.test(payload.sessionId) ||
      !Number.isInteger(payload.issuedAt) ||
      !Number.isInteger(payload.expiresAt) ||
      payload.expiresAt! - payload.issuedAt! !== GRANT_LIFETIME_SECONDS
    ) {
      throw new Error("invalid payload");
    }

    const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
    if (payload.expiresAt! < now) throw new Error("expired");
    if (payload.issuedAt! > now + 60) throw new Error("invalid issue time");

    return {
      sessionId: payload.sessionId,
      expiresAt: payload.expiresAt,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes("n\u00e3o configurado")) throw error;
    if (error instanceof Error && error.message === "expired") {
      throw new Error("Link de envio expirado. Volte ao WhatsApp para gerar outro.");
    }
    throw new Error("Link de envio inv\u00e1lido.");
  }
}
