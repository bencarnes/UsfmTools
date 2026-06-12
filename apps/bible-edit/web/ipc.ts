const CHANNEL_PREFIX = "bible-edit";

type HostListener = (payload: unknown) => void;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

const pending = new Map<string, PendingRequest>();
let seq = 0;

function getHost() {
  const host = globalThis.window?.host;
  if (!host) {
    throw new Error("Forge host bridge is unavailable.");
  }
  return host;
}

function ipcRequest<T>(channel: string, data?: unknown): Promise<T> {
  const requestId = `${channel}:${++seq}`;
  return new Promise((resolve, reject) => {
    pending.set(requestId, { resolve: resolve as (value: unknown) => void, reject });
    getHost().send(channel, { requestId, data });
  });
}

let bridgeInitialized = false;

function ensureBridge() {
  if (bridgeInitialized) return;
  bridgeInitialized = true;

  getHost().on(`${CHANNEL_PREFIX}:response`, (payload: unknown) => {
    const message = payload as {
      requestId?: string;
      ok?: boolean;
      result?: unknown;
      error?: string;
    };
    if (!message.requestId) return;
    const entry = pending.get(message.requestId);
    if (!entry) return;
    pending.delete(message.requestId);
    if (message.ok) {
      entry.resolve(message.result);
    } else {
      entry.reject(new Error(message.error ?? "Host request failed"));
    }
  });
}

export interface ForgeHostState {
  readonly label: string;
  readonly folderPath: string | null;
}

export function subscribeHostState(listener: HostListener): () => void {
  ensureBridge();
  const channel = `${CHANNEL_PREFIX}:host-state`;
  getHost().on(channel, listener);
  return () => getHost().off(channel);
}

export function signalReady(): void {
  ensureBridge();
  getHost().emit(`${CHANNEL_PREFIX}:ready`);
}

export async function forgeListFiles() {
  return await ipcRequest<Awaited<ReturnType<import("@usfm-tools/controls").UsfmShellHost["listFiles"]>>>(
    `${CHANNEL_PREFIX}:list-files`,
  );
}

export async function forgeReadFile(fileId: string) {
  return await ipcRequest<string | null>(`${CHANNEL_PREFIX}:read-file`, fileId);
}

export async function forgePickFolder() {
  return await ipcRequest<ForgeHostState>(`${CHANNEL_PREFIX}:pick-folder`);
}

export async function forgeLoadSettings() {
  return await ipcRequest<import("@usfm-tools/controls").ApplicationSettings | null>(
    `${CHANNEL_PREFIX}:load-settings`,
  );
}

export async function forgeSaveSettings(settings: import("@usfm-tools/controls").ApplicationSettings) {
  return await ipcRequest<null>(`${CHANNEL_PREFIX}:save-settings`, settings);
}
