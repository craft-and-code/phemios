import { parseDevices, deviceKey, slimprotoDevice, type Device } from "./profiles";
import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { requestAede } from "../platform/desktop";
import { referenceSource, type SourceId } from "../library/sources";
import type { AccountSession } from "../library/server";
import { t } from "../i18n";
interface Run {
  id: number;
  status: string;
}
const root = "/api/admin/v1/network-audio";
/** Explicit network-device commands belong to one exact source/login; ordinary browsing never discovers LAN devices. */
export function createNetworkAudio(options: {
  source: () => SourceId;
  session: (source: SourceId) => AccountSession | undefined;
  queue: () => readonly { reference: string }[];
  beforeStart: () => Promise<void>;
}) {
  const scope = createMemo(() => ({
    source: options.source(),
    owner: options.session(options.source()),
  }));
  type Scope = ReturnType<typeof scope>;
  const [devices, setDevices] = createSignal<Device[]>([]),
    [profiles, setProfiles] = createSignal(false),
    [observed, setObserved] = createSignal<{ key: string; sha256: string }>(),
    [discoveredBind, setDiscoveredBind] = createSignal(""),
    [run, setRun] = createSignal<Run>(),
    [busy, setBusy] = createSignal(false),
    [error, setError] = createSignal(""),
    [readError, setReadError] = createSignal("");
  let alive = true,
    serial = 0,
    timer: ReturnType<typeof setTimeout> | undefined;
  const current = (held: Scope, ticket: number) => alive && held === scope() && ticket === serial;
  const active = () => ["running", "stopping"].includes(run()?.status ?? "");
  createEffect(() => {
    scope();
    serial++;
    clearTimeout(timer);
    setDevices([]);
    setProfiles(false);
    setObserved(undefined);
    setDiscoveredBind("");
    setRun(undefined);
    setError("");
    setReadError("");
    setBusy(false);
  });
  onCleanup(() => {
    alive = false;
    serial++;
    clearTimeout(timer);
  });
  function checkedRun(raw: unknown): Run {
    const row = raw as Run;
    if (
      !row ||
      !Number.isSafeInteger(row.id) ||
      row.id <= 0 ||
      !["running", "stopping", "completed", "stopped", "stop_unconfirmed", "failed"].includes(
        row.status,
      )
    )
      throw new Error(t("Réponse audio réseau invalide."));
    return row;
  }
  function poll(held: Scope, ticket: number) {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (!current(held, ticket)) return;
      try {
        const raw = await requestAede(root, {}, "GET", null, held.source, held.owner);
        if (!current(held, ticket)) return;
        if (raw === null) {
          setReadError("");
          setRun(undefined);
          return;
        }
        const value = checkedRun(raw);
        if (value.id !== run()?.id) throw new Error(t("La session audio réseau a changé."));
        setReadError("");
        setRun(value);
        if (active()) poll(held, ticket);
      } catch (failure) {
        if (current(held, ticket)) {
          setReadError(String(failure));
          if (active()) poll(held, ticket);
        }
      }
    }, 1000);
  }
  async function perform(work: (held: Scope, ticket: number) => Promise<void>) {
    const held = scope();
    if (!alive || busy() || held.owner?.account.role !== "admin") return;
    const ticket = ++serial;
    setBusy(true);
    setError("");
    clearTimeout(timer);
    try {
      await work(held, ticket);
    } catch (failure) {
      if (current(held, ticket))
        setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      if (current(held, ticket)) {
        setBusy(false);
        if (active()) poll(held, ticket);
      }
    }
  }
  return {
    devices,
    profiles,
    observed,
    run,
    active,
    busy,
    error: () => error() || readError(),
    enabled: () => scope().owner?.account.role === "admin",
    clearError: () => {
      setError("");
      setReadError("");
    },
    cancelRead() {
      serial++;
      clearTimeout(timer);
      setBusy(false);
      if (active()) poll(scope(), serial);
    },
    discover: (bind: string) =>
      perform(async (held, ticket) => {
        const info = await requestAede<{ capabilities?: string[] }>(
          "/api/v1/status",
          {},
          "GET",
          null,
          held.source,
          held.owner,
        );
        if (!current(held, ticket)) return;
        if (!info.capabilities?.includes("network_audio_upnp"))
          throw new Error(t("Mettez à jour puis redémarrez Aède pour les sorties UPnP."));
        const modern = info.capabilities?.includes("network_audio_profiles") === true;
        const raw = await requestAede<unknown>(
          `${root}/discover`,
          {},
          "POST",
          modern ? { bind, all: true } : { bind },
          held.source,
          held.owner,
        );
        if (!current(held, ticket)) return;
        setDevices(parseDevices(raw));
        setProfiles(modern);
        setDiscoveredBind(bind);
        setObserved(undefined);
        const errors = (raw as { errors?: unknown }).errors;
        if (Array.isArray(errors) && errors.length)
          setError(t("La découverte de certains protocoles a échoué. Réessayez."));
      }),
    addSlimproto: (bind: string, ip: string) =>
      perform(async (held, ticket) => {
        const device = slimprotoDevice(ip);
        const info = await requestAede<{ capabilities?: string[] }>(
          "/api/v1/status",
          {},
          "GET",
          null,
          held.source,
          held.owner,
        );
        if (!current(held, ticket)) return;
        if (!info.capabilities?.includes("network_audio_profiles"))
          throw new Error(t("Mettez à jour puis redémarrez Aède pour les sorties réseau."));
        const retained = discoveredBind() === bind ? devices() : [];
        if (retained.length >= 96 && !retained.some((row) => deviceKey(row) === deviceKey(device)))
          throw new Error(t("Trop d’appareils réseau."));
        setDevices(
          parseDevices({
            items: [...retained.filter((row) => deviceKey(row) !== deviceKey(device)), device],
          }),
        );
        setProfiles(true);
        setDiscoveredBind(bind);
        setObserved(undefined);
      }),
    inspect: (key: string) =>
      perform(async (held, ticket) => {
        const device = devices().find((row) => deviceKey(row) === key);
        if (!profiles() || device?.protocol !== "googlecast") return;
        setObserved(undefined);
        const raw = await requestAede<{ sha256?: unknown }>(
          `${root}/inspect`,
          {},
          "POST",
          { bind: discoveredBind(), device: device.endpoint },
          held.source,
          held.owner,
        );
        if (!current(held, ticket)) return;
        if (typeof raw?.sha256 !== "string" || !/^[a-fA-F0-9]{64}$/.test(raw.sha256))
          throw new Error(t("Empreinte Cast invalide."));
        setObserved({ key, sha256: raw.sha256 });
      }),
    start: (bind: string, endpoint: string, settings: { pin?: string; replace?: boolean } = {}) =>
      perform(async (held, ticket) => {
        const tracks = options.queue().map((row) => row.reference);
        const device = devices().find(
          (row) => deviceKey(row) === endpoint || row.endpoint === endpoint,
        );
        if (
          !device ||
          discoveredBind() !== bind ||
          active() ||
          !tracks.length ||
          tracks.length > 64 ||
          tracks.some((ref) => referenceSource(ref) !== held.source)
        )
          throw new Error(
            t("Sélectionnez de 1 à 64 pistes de la même bibliothèque pour le lecteur réseau."),
          );
        if (
          device.protocol === "googlecast" &&
          (!settings.pin ||
            observed()?.key !== deviceKey(device) ||
            observed()?.sha256 !== settings.pin)
        )
          throw new Error(t("Inspectez puis vérifiez l’empreinte du récepteur Cast."));
        await options.beforeStart();
        if (!current(held, ticket)) return;
        const value = checkedRun(
          await requestAede(
            `${root}/play`,
            {},
            "POST",
            profiles()
              ? {
                  bind,
                  device: device.endpoint,
                  tracks,
                  protocol: device.protocol,
                  replace: settings.replace === true,
                  ...(device.protocol === "googlecast" ? { certificate_sha256: settings.pin } : {}),
                }
              : { bind, device: device.endpoint, tracks },
            held.source,
            held.owner,
          ),
        );
        if (!current(held, ticket)) {
          // A late accepted command must not leave an unowned receiver playing.
          await requestAede(
            `${root}/stop`,
            {},
            "POST",
            { id: value.id },
            held.source,
            held.owner,
          ).catch(() => {});
          return;
        }
        setRun(value);
      }),
    stop: () =>
      perform(async (held, ticket) => {
        const value = run();
        if (!value) return;
        const result = checkedRun(
          await requestAede(`${root}/stop`, {}, "POST", { id: value.id }, held.source, held.owner),
        );
        if (current(held, ticket)) setRun(result);
      }),
  };
}
