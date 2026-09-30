import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import Section from "../components/Section";
import {
  diffMaps,
  MAP_COLS,
  MAP_RPMS,
  toEcuGrid,
  type JukenMapKey
} from "../juken/protocol";
import { JukenSession, type MapAddresses } from "../juken/client";
import {
  ensureBluetoothReady,
  isBluetoothSupported,
  pairAndConnect,
  scanDevices,
  type BtDeviceInfo,
  type Transport
} from "../juken/transport";
import { useEngine } from "../engineState";
import { Colors, FontSize, Spacing } from "../theme";

type Phase =
  | "idle"
  | "scanning"
  | "pairing"
  | "connecting"
  | "addresses"
  | "reading"
  | "writing"
  | "verifying"
  | "executing";

const PHASE_TEXT: Record<Phase, string> = {
  idle: "Terputus",
  scanning: "Mencari perangkat…",
  pairing: "Menunggu konfirmasi pair…",
  connecting: "Menyambung ke ECU…",
  addresses: "Membaca alamat memori…",
  reading: "Membaca peta dari ECU…",
  writing: "Mengirim peta ke ECU…",
  verifying: "Mengecek hasil tulis…",
  executing: "Menjalankan peta…"
};

/** Peta ECU yang boleh ditulis dari app. Fuel Correction sengaja dikecualikan. */
const WRITABLE: readonly JukenMapKey[] = ["baseMap", "ignition"];

interface ReadResult {
  map: JukenMapKey;
  grid: number[][];
  address: string;
}

const LOG_LIMIT = 200;

export default function JukenScreen() {
  const { baseMap, ignition, rpms } = useEngine();

  const [phase, setPhase] = useState<Phase>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [devices, setDevices] = useState<BtDeviceInfo[]>([]);
  const [addresses, setAddresses] = useState<MapAddresses | null>(null);
  const [deviceLabel, setDeviceLabel] = useState("");
  const [connected, setConnected] = useState(false);
  const [read, setRead] = useState<ReadResult | null>(null);

  const sessionRef = useRef<JukenSession | null>(null);
  const stopScanRef = useRef<(() => Promise<void>) | null>(null);
  // Log masuk dari callback I/O, bukan dari render. Kalau dipanggil langsung ke
  // setState tiap byte, layar drop frame — itu penyebab "glitch" sebelumnya.
  const logBuf = useRef<string[]>([]);
  const logTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const supported = useMemo(() => isBluetoothSupported(), []);

  // Teks log tidak punya titik wrap alami di beberapa string ECU; sisipkan
  // espaço tipis setelah pemisah supaya tidak pernah melebar ke kanan.
  const wrappable = useCallback(
    (line: string) => line.replace(/([·:])(?=\S)/g, "$1\u200B"),
    []
  );

  const flushLog = useCallback(() => {
    if (logBuf.current.length) {
      const batch = logBuf.current.splice(0, logBuf.current.length);
      setLog((prev) =>
        [...batch.reverse().map(wrappable), ...prev].slice(0, LOG_LIMIT)
      );
    }
  }, [wrappable]);

  const pushLog = useCallback(
    (line: string) => {
      logBuf.current.push(line);
      // Satu setState maksimal tiap 250 ms, bukan satu per baris.
      if (!logTimer.current) {
        logTimer.current = setInterval(flushLog, 250);
      }
    },
    [flushLog],
  );

  useEffect(() => {
    return () => {
      if (logTimer.current) clearInterval(logTimer.current);
      void stopScanRef.current?.();
    };
  }, []);

  const endSession = useCallback(async () => {
    const s = sessionRef.current;
    sessionRef.current = null;
    setConnected(false);
    setAddresses(null);
    setRead(null);
    setPhase("idle");
    if (s) {
      try {
        await s.disconnect();
        pushLog("Sesi ditutup");
      } catch {
        // sudah putus — abaikan
      }
    }
  }, [pushLog]);

  useEffect(() => {
    return () => {
      const s = sessionRef.current;
      sessionRef.current = null;
      void s?.disconnect();
    };
  }, []);

  const stopScan = useCallback(async () => {
    const stop = stopScanRef.current;
    stopScanRef.current = null;
    if (stop) await stop();
  }, []);

  const scan = useCallback(async () => {
    if (!supported) {
      Alert.alert(
        "Bluetooth tidak didukung",
        "Koneksi ECU JUKEN hanya lewat Bluetooth Classic (SPP), jadi harus Android."
      );
      return;
    }
    await stopScan();
    setPhase("scanning");
    setDevices([]);
    try {
      await ensureBluetoothReady();
    } catch (e) {
      setPhase("idle");
      const msg = e instanceof Error ? e.message : String(e);
      pushLog(`Prasyarat gagal: ${msg}`);
      Alert.alert("Belum bisa scan", msg);
      return;
    }
    try {
      // Streaming: perangkat baru langsung masuk daftar, tanpa nunggu selesai.
      stopScanRef.current = await scanDevices((d) => {
        setDevices((prev) =>
          prev.some((x) => x.address === d.address)
            ? prev
            : [...prev, d].sort(
                (a, b) => Number(b.bonded) - Number(a.bonded),
              ),
        );
      });
      pushLog("Scan jalan — ketuk perangkat untuk pair + konek");
    } catch (e) {
      setPhase("idle");
      const msg = e instanceof Error ? e.message : String(e);
      pushLog(`Scan gagal: ${msg}`);
      Alert.alert("Gagal scan", msg);
    }
  }, [pushLog, stopScan, supported]);

  const connect = useCallback(
    async (device: BtDeviceInfo) => {
      await stopScan();
      setPhase(device.bonded ? "connecting" : "pairing");
      pushLog(
        `${device.bonded ? "Menyambung" : "Pair lalu menyambung"} ke ${device.name || device.address}…`
      );
      let transport: Transport;
      try {
        // Satu jalur untuk semua: pair dulu kalau perlu, baru sambung.
        // Device yang belum ter-pair akan memunculkan dialog pair dari Android.
        transport = await pairAndConnect(device.address);
      } catch (e) {
        setPhase("idle");
        const msg = e instanceof Error ? e.message : String(e);
        pushLog(`Gagal: ${msg}`);
        Alert.alert("Gagal sambung", msg);
        return;
      }

      const s = new JukenSession(transport, { onLog: pushLog });
      sessionRef.current = s;
      setConnected(true);
      setDeviceLabel(device.name || device.address);
      setPhase("addresses");
      try {
        const { addresses: a } = await s.readAddresses();
        setAddresses(a);
        setPhase("idle");
        pushLog(
          `Alamat: Base ${a.baseMap} · Fuel ${a.fuel} · IT ${a.injectorTiming} · IG ${a.ignition}`
        );
      } catch (e) {
        setPhase("idle");
        const msg = e instanceof Error ? e.message : String(e);
        pushLog(`Alamat gagal: ${msg}`);
        Alert.alert(
          "Sambung berhasil, alamat gagal",
          `${msg}\n\nECU mungkin belum selesai boot, atau belum ter-pair. ` +
            "Coba Putuskan lalu sambung lagi."
        );
      }
    },
    [pushLog, stopScan],
  );

  const mapGrid = useCallback(
    (map: JukenMapKey): number[][] =>
      toEcuGrid(map, map === "baseMap" ? baseMap : ignition, rpms),
    [baseMap, ignition, rpms],
  );

  const readFromEcu = useCallback(
    async (map: JukenMapKey) => {
      const s = sessionRef.current;
      const a = addresses;
      if (!s || !a) {
        Alert.alert("Belum terhubung", "Pair lalu sambung ke ECU dulu.");
        return;
      }
      setPhase("reading");
      try {
        const grid = await s.readMap(map, a[map], (row) =>
          pushLog(`Baca ${map} baris ${row}/21`)
        );
        setRead({ map, grid, address: a[map] });
        setPhase("idle");
        pushLog(`Baca selesai: ${grid.length} baris × ${grid[0]?.length ?? 0} kolom`);
      } catch (e) {
        setPhase("idle");
        const msg = e instanceof Error ? e.message : String(e);
        pushLog(`Baca gagal: ${msg}`);
        Alert.alert("Gagal baca", msg);
      }
    },
    [addresses, pushLog],
  );

  /**
   * Tulis → execute → baca ulang → bandingkan. Urutan wajib: ECU baru memakai
   * nilai baru setelah `5009`, jadi verifikasi harus setelahnya.
   */
  const writeToEcu = useCallback(
    async (map: JukenMapKey) => {
      const s = sessionRef.current;
      const a = addresses;
      if (!s || !a) {
        Alert.alert("Belum terhubung", "Pair lalu sambung ke ECU dulu.");
        return;
      }
      const target = mapGrid(map);
      Alert.alert(
        "Tulis peta ke ECU?",
        `${MAP_COLS[map]} kolom × 21 baris ke memori ${a[map]}. ` +
          "Mesin harus MATI. Lanjut?",
        [
          { text: "Batal", style: "cancel" },
          {
            text: "Tulis & execute",
            style: "destructive",
            onPress: async () => {
              setPhase("writing");
              try {
                await s.writeMap(map, a[map], target, (row) =>
                  pushLog(`Kirim baris ${row}/21`)
                );
                setPhase("executing");
                await s.execute();
                await new Promise((r) => setTimeout(r, 800));

                setPhase("verifying");
                pushLog("Baca ulang untuk verifikasi…");
                const back = await s.readMap(map, a[map], (row) =>
                  pushLog(`Verifikasi baris ${row}/21`)
                );
                const d = diffMaps(back, target, map);
                setPhase("idle");
                if (d.mismatches === 0) {
                  pushLog(
                    `Verifikasi OK (selisih maks ${d.maxDelta.toFixed(3)})`
                  );
                  Alert.alert(
                    "Berhasil",
                    `Peta ${map} cocok dengan ECU. Selisih maks ${d.maxDelta.toFixed(3)}.`
                  );
                } else {
                  pushLog(
                    `Verifikasi GAGAL: ${d.mismatches} selisih. Pertama: ${d.firstMismatch}`
                  );
                  Alert.alert(
                    "Verifikasi gagal",
                    `${d.mismatches} kolom tidak cocok setelah tulis.\n${d.firstMismatch ?? ""}\n\n` +
                      "Jangan jalankan mesin. Periksa log dan coba lagi."
                  );
                }
              } catch (e) {
                setPhase("idle");
                const msg = e instanceof Error ? e.message : String(e);
                pushLog(`Tulis gagal: ${msg}`);
                Alert.alert("Gagal tulis", msg);
              }
            }
          }
        ]
      );
    },
    [addresses, mapGrid, pushLog],
  );

  const busy = phase !== "idle";

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>ECU JUKEN 5+</Text>
        <Text style={styles.heroSub}>
          Bluetooth Classic SPP · mesin harus mati saat menulis
        </Text>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.dot,
              { backgroundColor: busy ? Colors.warn : Colors.textDim }
            ]}
          />
          <Text style={styles.status}>
            {PHASE_TEXT[phase]}
            {deviceLabel ? ` · ${deviceLabel}` : ""}
          </Text>
          {busy ? <ActivityIndicator size="small" color={Colors.accent} /> : null}
        </View>
      </View>

      <Section title="Koneksi" block>
        {!supported ? (
          <Text style={styles.warnText}>
            Platform ini tidak mendukung Bluetooth SPP. Jalankan di Android.
          </Text>
        ) : (
          <>
            <Pressable
              style={[styles.btn, busy && styles.btnBusy]}
              onPress={scan}
              disabled={busy}
            >
              <Text style={styles.btnText}>Scan / pair ECU</Text>
            </Pressable>
            {devices.length === 0 ? (
              <Text style={styles.hint}>
                Tekan Scan. Kalau ECU belum muncul, buka Pengaturan Bluetooth →
                Pair new device dulu (pairing SPP tidak bisa dari dalam app).
              </Text>
            ) : null}
            {devices.map((d) => (
              <Pressable
                key={d.address}
                style={[styles.device, busy && styles.deviceBusy]}
                onPress={() => connect(d)}
                disabled={busy}
              >
                <View style={styles.deviceRow}>
                  <Text style={styles.deviceName}>
                    {d.name || "(tanpa nama)"}
                  </Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {d.bonded ? "paired" : "pair dulu"}
                    </Text>
                  </View>
                </View>
                <Text style={styles.deviceAddr}>{d.address}</Text>
              </Pressable>
            ))}
            {connected ? (
              <Pressable
                style={[styles.btn, styles.btnDanger]}
                onPress={endSession}
                disabled={busy}
              >
                <Text style={styles.btnText}>Putuskan</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </Section>

      <Section title="Alamat memori" block>
        {addresses ? (
          Object.entries(addresses).map(([k, v]) => (
            <Text key={k} style={styles.addrLine}>
              {k}: {v}
            </Text>
          ))
        ) : (
          <Text style={styles.hint}>
            Terbaca otomatis setelah sambung. Tanpa ini ECU tidak tahu peta mana
            yang ditimpa.
          </Text>
        )}
      </Section>

      <Section title="Baca / tulis" block>
        {WRITABLE.map((map) => (
          <View key={map} style={styles.rowGroup}>
            <Text style={styles.rowTitle}>
              {map} ({MAP_COLS[map]} kolom × 21)
            </Text>
            <View style={styles.row}>
              <Pressable
                style={[styles.btnSmall, busy && styles.btnBusy]}
                onPress={() => readFromEcu(map)}
                disabled={busy || !connected}
              >
                <Text style={styles.btnSmallText}>Baca</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.btnSmall,
                  styles.btnWarnSmall,
                  busy && styles.btnBusy
                ]}
                onPress={() => writeToEcu(map)}
                disabled={busy || !connected}
              >
                <Text style={styles.btnSmallText}>Tulis + execute</Text>
              </Pressable>
            </View>
          </View>
        ))}
        <Text style={styles.hint}>
          Fuel Correction tidak ditulis dari sini — nilainya tetap 0%.
        </Text>
      </Section>

      {read ? (
        <Section title="Hasil baca ECU" block>
          <Text style={styles.addrLine}>
            {read.map} dari memori {read.address} ·{" "}
            {read.grid[0]?.length ?? 0} kolom × {read.grid.length} baris
          </Text>
          <Text style={styles.hint}>
            Kolom ECU: {MAP_RPMS[read.map][0]}–
            {MAP_RPMS[read.map][MAP_COLS[read.map] - 1]} rpm
          </Text>
          <Text style={styles.readLine}>
            TPS {MAP_RPMS[read.map][0]} pertama:{" "}
            {read.grid[0]?.slice(0, 6).join(" · ")}
          </Text>
        </Section>
      ) : null}

      <Section title="Log" block>
        {log.length === 0 ? (
          <Text style={styles.hint}>Belum ada aktivitas.</Text>
        ) : (
          log.map((l, i) => (
            <Text key={i} style={styles.logLine}>
              {l}
            </Text>
          ))
        )}
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
    // anak-apa pun yang menolak menyusut tidak boleh mendorong halaman melebar
    alignItems: "stretch",
    flexGrow: 1
  },
  hero: { marginBottom: Spacing.lg },
  heroTitle: {
    color: Colors.text,
    fontSize: FontSize.xl,
    fontWeight: "800"
  },
  heroSub: {
    color: Colors.textDim,
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
    flexShrink: 1
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
    gap: Spacing.sm
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  status: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontWeight: "600",
    flexShrink: 1,
    flexGrow: 1
  },
  btn: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: Spacing.md,
    alignItems: "center",
    marginTop: Spacing.sm
  },
  btnBusy: { opacity: 0.5 },
  btnDanger: { backgroundColor: Colors.danger },
  btnText: { color: "#111", fontWeight: "800", fontSize: FontSize.md },
  device: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 10,
    padding: Spacing.md,
    marginTop: Spacing.sm
  },
  deviceBusy: { opacity: 0.5 },
  deviceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  deviceName: {
    color: Colors.text,
    fontWeight: "700",
    flexShrink: 1,
    minWidth: 0
  },
  deviceAddr: {
    color: Colors.textDim,
    fontSize: FontSize.xs,
    marginTop: 2
  },
  badge: {
    backgroundColor: Colors.surface,
    borderRadius: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    marginLeft: Spacing.sm
  },
  badgeText: { color: Colors.textDim, fontSize: FontSize.xs },
  addrLine: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontFamily: "monospace",
    marginBottom: 2
  },
  hint: {
    color: Colors.textDim,
    fontSize: FontSize.xs,
    marginTop: Spacing.sm,
    lineHeight: 16
  },
  warnText: { color: Colors.warn, fontSize: FontSize.sm },
  rowGroup: { marginTop: Spacing.sm },
  rowTitle: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontWeight: "700",
    marginBottom: Spacing.xs
  },
  row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  btnSmall: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 8,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginRight: Spacing.sm,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    alignItems: "center"
  },
  btnWarnSmall: { backgroundColor: Colors.accentDim },
  btnSmallText: {
    color: Colors.text,
    fontWeight: "700",
    fontSize: FontSize.sm,
    textAlign: "center",
    flexShrink: 1
  },
  readLine: { color: Colors.textDim, fontSize: FontSize.xs, marginTop: 4 },
  logLine: {
    color: Colors.textDim,
    fontSize: FontSize.xs,
    fontFamily: "monospace",
    marginBottom: 2
  }
});
