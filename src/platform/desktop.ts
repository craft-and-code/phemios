import { invoke, isTauri } from "@tauri-apps/api/core";

/** Versioned bridge metadata; no music folders or credentials are exposed. */
export interface RuntimeInfo {
  bridgeVersion: number;
  name: string;
  version: string;
  native: boolean;
}

/** Browser previews stay offline and report their lack of native capabilities. */
export async function getRuntimeInfo(): Promise<RuntimeInfo> {
  if (!isTauri()) {
    return { bridgeVersion: 1, name: "Phémios", version: "0.1.0", native: false };
  }
  const info = await invoke<RuntimeInfo>("runtime_info");
  if (info.bridgeVersion !== 1) {
    throw new Error("Incompatible Phémios desktop bridge. Update the application.");
  }
  return info;
}
