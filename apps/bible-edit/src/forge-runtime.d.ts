/** Minimal Forge runtime typings for `deno check` outside `forge dev`. */
declare module "runtime:app" {
  export type AppPathType =
    | "home"
    | "appData"
    | "documents"
    | "downloads"
    | "desktop"
    | "music"
    | "pictures"
    | "videos"
    | "temp"
    | "exe"
    | "resources"
    | "logs"
    | "cache";

  export function getPath(pathType: AppPathType): Promise<string>;
}

declare module "runtime:fs" {
  export interface DirEntry {
    readonly name: string;
    readonly isFile: boolean;
    readonly isDirectory: boolean;
    readonly isSymlink: boolean;
  }

  export function readTextFile(path: string): Promise<string>;
  export function writeTextFile(path: string, content: string): Promise<void>;
  export function readDir(path: string): Promise<readonly DirEntry[]>;
  export function exists(path: string): Promise<boolean>;
  export function mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
}

declare module "runtime:ipc" {
  export interface IpcEvent {
    readonly windowId: string;
    readonly channel: string;
    readonly payload: unknown;
  }

  export function sendToWindow(windowId: string, channel: string, payload?: unknown): Promise<void>;
  export function windowEvents(): AsyncGenerator<IpcEvent>;
}

declare module "runtime:window" {
  export interface FileDialogOptions {
    readonly title?: string;
    readonly defaultPath?: string;
    readonly multiple?: boolean;
    readonly directory?: boolean;
  }

  export interface WindowOptions {
    readonly url?: string;
    readonly width?: number;
    readonly height?: number;
    readonly title?: string;
    readonly resizable?: boolean;
  }

  export interface Window {
    readonly id: string;
  }

  export const dialog: {
    open(options?: FileDialogOptions): Promise<string[] | null>;
    alert(message: string, title?: string): Promise<void>;
  };

  export function createWindow(options?: WindowOptions): Promise<Window>;
}

interface ForgeHostBridge {
  send(channel: string, payload?: unknown): void;
  emit(channel: string, payload?: unknown): void;
  on(channel: string, callback: (payload: unknown) => void): void;
  off(channel: string): void;
}

interface Window {
  host?: ForgeHostBridge;
}
