import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import NumField from "../components/NumField";
import Section from "../components/Section";
import StatCard from "../components/StatCard";
import {
  airDensityGL,
  computeStats,
  horsepowerAt,
  redlineRPM,
  specInputIssues,
  validateSpec
} from "../engine";
import { useEngine } from "../engineState";
import { Colors, FontSize, Spacing } from "../theme";
import type { SetupKey } from "../types";

const SETUP_OPTIONS: { key: SetupKey; label: string }[] = [
  { key: "motor", label: "Motor Gw (default)" },
  { key: "umum", label: "Setup Umum (kosong)" }
];

export default function SetupScreen() {
  const { spec, active, setActive, updateSpec } = useEngine();
  const stats = computeStats(spec);
  const [menuOpen, setMenuOpen] = useState(false);

  const inputIssues = specInputIssues(spec);
  const issuesByKey = new Map(inputIssues.map((i) => [i.key, i.msg]));

  const hpAtTorque = horsepowerAt(spec, stats.torquePeakRPM);
  const hpAtMax = horsepowerAt(spec, redlineRPM(spec));

  const focus = SETUP_OPTIONS.find((o) => o.key === active) ?? SETUP_OPTIONS[0];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Mapping ECU for Juken 5++</Text>
        <Text style={styles.heroSub}>Fuel · Ignition · Injector Timing</Text>

        <View style={styles.dropdownWrap}>
          <Pressable
            style={styles.dropdownBtn}
            onPress={() => setMenuOpen((o) => !o)}
          >
            <Text style={styles.dropdownText}>{focus.label}</Text>
            <Text style={styles.dropdownCaret}>{menuOpen ? "▲" : "▼"}</Text>
          </Pressable>
          {menuOpen ? (
            <View style={styles.dropdownMenu}>
              {SETUP_OPTIONS.map((o) => (
                <Pressable
                  key={o.key}
                  style={[
                    styles.dropdownItem,
                    o.key === active && styles.dropdownItemActive
                  ]}
                  onPress={() => {
                    setActive(o.key);
                    setMenuOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      o.key === active && styles.dropdownItemTextActive
                    ]}
                  >
                    {o.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        <TextInput
          style={styles.nameInput}
          value={spec.name}
          onChangeText={(t) => updateSpec({ name: t })}
          placeholder="Nama setup / motor"
          placeholderTextColor={Colors.textDim}
        />
      </View>

      <Section title="Analisa Mesin">
        <StatCard
          label="Kapasitas (cc)"
          value={`${stats.sweptCC} cc`}
          sub={`Bore ${stats.boreRealMM}mm`}
          tone="ok"
        />
        <StatCard
          label="Volume Burni"
          value={`${stats.clearanceCC} cc`}
          sub={`CR ${spec.compressionRatio}:1`}
        />
        <StatCard
          label="Densitas Udara"
          value={`${airDensityGL(spec)} g/L`}
          sub={`@${spec.airTempC || 20}°C, ${spec.altitudeM || 0}m dpl`}
          tone="ok"
        />
        <StatCard
          label="Torsi Puncak"
          value={`${stats.torquePeakRPM.toLocaleString("id-ID")} rpm`}
          sub={`~${hpAtTorque.toFixed(1)} HP di sini`}
        />
        <StatCard
          label="Power Puncak"
          value={`~${stats.powerPeakHP} HP`}
          sub={`di ${stats.powerPeakRPM.toLocaleString("id-ID")} rpm (estimasi)`}
          tone="warn"
        />
        <StatCard
          label="Kecepatan Piston"
          value={`${stats.maxPistonSpeed} m/s`}
          sub={`@ ${redlineRPM(spec).toLocaleString("id-ID")} rpm (limiter)`}
        />
        <StatCard
          label="Injektor Butuh"
          value={`${stats.injRequiredPer} cc/min`}
          sub={
            stats.injRequiredPer > spec.injectorFlowCC
              ? `Terpasang ${spec.injectorFlowCC} cc/min - KURANG`
              : `Terpasang ${spec.injectorFlowCC} cc/min - cukup`
          }
          tone={stats.injRequiredPer > spec.injectorFlowCC ? "danger" : "ok"}
        />
        <StatCard
          label="Duty Cycle Injector"
          value={`${(stats.dutyAtLimiter * 100).toFixed(0)}%`}
          sub={`peak ${(stats.dutyAtPeak * 100).toFixed(0)}% · limiter ${redlineRPM(spec).toLocaleString("id-ID")} rpm`}
          tone={stats.dutyAtLimiter > 0.85 ? "warn" : "default"}
        />
        <StatCard
          label="TB vs Bore"
          value={`${stats.tbsqToBoreRatio}%`}
          sub={`TB ${spec.throttleBodyMM}mm / bore ${stats.boreRealMM}mm`}
        />
        <StatCard
          label="Klep vs Bore"
          value={`IN ${stats.valveInRatio}%`}
          sub={`IN ${spec.valveIntakeMM} / EX ${spec.valveExhaustMM}mm`}
        />
        <StatCard
          label="Curtain Klep IN"
          value={`${stats.curtainInMM2} mm²`}
          sub={`π×${spec.valveIntakeMM}×${spec.intakeLift}`}
        />
        <StatCard
          label="Flow Ceiling"
          value={`${stats.flowCeilingHP} HP`}
          sub="Batas atas dari luas klep"
          tone={stats.powerPeakHP > stats.flowCeilingHP ? "warn" : "default"}
        />
        <StatCard
          label="Header vs Bore"
          value={`${stats.headerVsBore}%`}
          sub={`P1 ${spec.exhaustP1MM}mm / bore ${stats.boreRealMM}mm`}
        />
      </Section>

      <Section title="Input Spek Wajib (dipakai hitung map)">
        {inputIssues.length === 0 ? (
          <Text style={styles.hintLine}>
            Semua field kritis terisi. Field opsional (TB, klep, lift, thermal,
            inlet knalpot, idle RPM) tidak memengaruhi hasil map.
          </Text>
        ) : (
          inputIssues.map((it) => (
            <View key={it.key} style={[styles.warnRow, styles.warnDanger]}>
              <Text style={[styles.warnIcon, { color: Colors.danger }]}>⚠</Text>
              <Text style={styles.warnText}>
                <Text style={styles.warnLabel}>{it.label}</Text> — {it.msg}
              </Text>
            </View>
          ))
        )}
      </Section>

      <Section title="Cek Kesehatan Spek">
        {validateSpec(spec, stats).map((it, i) => (
          <View
            key={i}
            style={[
              styles.warnRow,
              it.severity === "danger"
                ? styles.warnDanger
                : it.severity === "warn"
                  ? styles.warnWarn
                  : styles.warnOk
            ]}
          >
            <Text
              style={[
                styles.warnIcon,
                it.severity === "danger"
                  ? { color: Colors.danger }
                  : it.severity === "warn"
                    ? { color: Colors.warn }
                    : { color: Colors.ok }
              ]}
            >
              {it.severity === "danger" ? "⚠" : it.severity === "warn" ? "!" : "✓"}
            </Text>
            <Text style={styles.warnText}>{it.msg}</Text>
          </View>
        ))}
      </Section>

      <Section title="Noken As & Klep">
        <Text style={styles.notes}>
          IN buka {spec.intakeIVO}° BTDC · tutup {spec.intakeIVC}° ABDC (durasi{" "}
          {spec.intakeIVO + 180 + spec.intakeIVC}°) · EX buka {spec.exhaustEVO}°
          BBDC · tutup {spec.exhaustEVC}° ATDC (durasi{" "}
          {spec.exhaustEVO + 180 + spec.exhaustEVC}°) · Overlap{" "}
          {stats.cam.overlap.toFixed(0)}°
        </Text>
        <NumField
          label="IN Buka (BTDC)"
          value={spec.intakeIVO}
          unit="°"
          step={1}
          min={0}
          max={80}
          hint="sebelum TMA"
          warn={issuesByKey.get("intakeIVO")}
          onChange={(v) => updateSpec({ intakeIVO: v })}
        />
        <NumField
          label="IN Tutup (ABDC)"
          value={spec.intakeIVC}
          unit="°"
          step={1}
          min={0}
          max={110}
          hint="sesudah TMB"
          warn={issuesByKey.get("intakeIVO")}
          onChange={(v) => updateSpec({ intakeIVC: v })}
        />
        <NumField
          label="EX Buka (BBDC)"
          value={spec.exhaustEVO}
          unit="°"
          step={1}
          min={0}
          max={110}
          hint="sebelum TMB"
          warn={issuesByKey.get("exhaustEVO")}
          onChange={(v) => updateSpec({ exhaustEVO: v })}
        />
        <NumField
          label="EX Tutup (ATDC)"
          value={spec.exhaustEVC}
          unit="°"
          step={1}
          min={0}
          max={80}
          hint="sesudah TMA"
          warn={issuesByKey.get("exhaustEVO")}
          onChange={(v) => updateSpec({ exhaustEVC: v })}
        />
        <NumField
          label="Lift Intake"
          value={spec.intakeLift}
          unit="mm"
          step={0.05}
          min={5}
          max={15}
          hint="opsional — ceiling HP saja"
          onChange={(v) => updateSpec({ intakeLift: v })}
        />
        <NumField
          label="Lift Exhaust"
          value={spec.exhaustLift}
          unit="mm"
          step={0.05}
          min={5}
          max={15}
          hint="opsional — tidak dipakai hitung map"
          onChange={(v) => updateSpec({ exhaustLift: v })}
        />
      </Section>

      <Section title="Mesin">
        <NumField
          label="Bore"
          value={spec.boreMM}
          unit="mm"
          step={0.5}
          min={40}
          max={120}
          warn={issuesByKey.get("boreMM")}
          onChange={(v) => updateSpec({ boreMM: v })}
        />
        <NumField
          label="Stroke"
          value={spec.strokeMM}
          unit="mm"
          step={0.5}
          min={40}
          max={120}
          warn={issuesByKey.get("strokeMM")}
          onChange={(v) => updateSpec({ strokeMM: v })}
        />
        <NumField
          label="Over Size"
          value={spec.oversizeMM}
          unit="mm"
          step={0.25}
          min={0}
          max={2}
          hint="opsional — dipakai sbg penambah bore"
          onChange={(v) => updateSpec({ oversizeMM: v })}
        />
        <NumField
          label="Silinder"
          value={spec.cylinders}
          unit="bh"
          step={1}
          min={1}
          max={6}
          warn={issuesByKey.get("cylinders")}
          onChange={(v) => updateSpec({ cylinders: v })}
        />
        <NumField
          label="Rasio Kompresi"
          value={spec.compressionRatio}
          unit=":1"
          step={0.5}
          min={7}
          max={16}
          warn={issuesByKey.get("compressionRatio")}
          onChange={(v) => updateSpec({ compressionRatio: v })}
        />
      </Section>

      <Section title="Injector & TB">
        <NumField
          label="Flow Injektor"
          value={spec.injectorFlowCC}
          unit="cc/min"
          step={5}
          min={20}
          max={1000}
          warn={issuesByKey.get("injectorFlowCC")}
          onChange={(v) => updateSpec({ injectorFlowCC: v })}
        />
        <NumField
          label="Jumlah"
          value={spec.injectorCount}
          unit="bh"
          step={1}
          min={1}
          max={6}
          warn={issuesByKey.get("injectorCount")}
          onChange={(v) => updateSpec({ injectorCount: v })}
        />
        <NumField
          label="Tekanan Bensin"
          value={spec.fuelPressureBar}
          unit="bar"
          step={0.5}
          min={1}
          max={6}
          warn={issuesByKey.get("fuelPressureBar")}
          onChange={(v) => updateSpec({ fuelPressureBar: v })}
        />
        <NumField
          label="Dead Time"
          value={spec.injectorDeadTime}
          unit="ms"
          step={0.05}
          min={0}
          max={2}
          warn={issuesByKey.get("injectorDeadTime")}
          onChange={(v) => updateSpec({ injectorDeadTime: v })}
        />
        <NumField
          label="Diameter TB"
          value={spec.throttleBodyMM}
          unit="mm"
          step={1}
          min={16}
          max={60}
          hint="opsional — statistik TB vs bore saja"
          onChange={(v) => updateSpec({ throttleBodyMM: v })}
        />
        <NumField
          label="VE Maks"
          value={spec.veMax}
          unit="x"
          step={0.01}
          min={0.7}
          max={1.15}
          hint="1.00 = 100%"
          warn={issuesByKey.get("veMax")}
          onChange={(v) => updateSpec({ veMax: v })}
        />
        <NumField
          label="Ketinggian"
          value={spec.altitudeM}
          unit="m"
          step={10}
          min={0}
          max={4000}
          hint="dpl; koreksi densitas udara (BAROMETRIC)"
          onChange={(v) => updateSpec({ altitudeM: v })}
        />
        <NumField
          label="Suhu Intake"
          value={spec.airTempC}
          unit="°C"
          step={1}
          min={0}
          max={60}
          hint="suhu udara hisap; makin panas makin encer udara"
          onChange={(v) => updateSpec({ airTempC: v })}
        />
      </Section>

      <Section title="Klep & Knalpot">
        <NumField
          label="Klep Intake"
          value={spec.valveIntakeMM}
          unit="mm"
          step={0.5}
          min={18}
          max={48}
          hint="opsional — statistik rasio klep & ceiling HP"
          onChange={(v) => updateSpec({ valveIntakeMM: v })}
        />
        <NumField
          label="Klep Exhaust"
          value={spec.valveExhaustMM}
          unit="mm"
          step={0.5}
          min={18}
          max={42}
          hint="opsional — statistik rasio klep"
          onChange={(v) => updateSpec({ valveExhaustMM: v })}
        />
        <NumField
          label="Header P1"
          value={spec.exhaustP1MM}
          unit="mm"
          step={1}
          min={20}
          max={60}
          hint="ujung taper, mis. 30-34-38 = 38"
          warn={issuesByKey.get("exhaustP1MM")}
          onChange={(v) => updateSpec({ exhaustP1MM: v })}
        />
        <NumField
          label="Inlet Knalpot"
          value={spec.exhaustInletMM}
          unit="mm"
          step={1}
          min={20}
          max={60}
          hint="opsional — tidak dipakai hitung map"
          onChange={(v) => updateSpec({ exhaustInletMM: v })}
        />
        <NumField
          label="Outlet Knalpot"
          value={spec.exhaustOutletMM}
          unit="mm"
          step={1}
          min={20}
          max={70}
          hint="ujung megaphone; dipakai utk posisi puncak torsi"
          warn={issuesByKey.get("exhaustOutletMM")}
          onChange={(v) => updateSpec({ exhaustOutletMM: v })}
        />
      </Section>

      <Section title="Bahan Bakar & Efisiensi">
        <NumField
          label="Oktan"
          value={spec.octane}
          unit="RON"
          step={1}
          min={82}
          max={100}
          warn={issuesByKey.get("octane")}
          onChange={(v) => updateSpec({ octane: v })}
        />
        <NumField
          label="Efisiensi Termal"
          value={spec.thermalEff}
          unit=""
          step={0.01}
          min={0.15}
          max={0.45}
          hint="opsional — estimasi HP saja (statistik)"
          onChange={(v) => updateSpec({ thermalEff: v })}
        />
        <NumField
          label="Offset Fase Injeksi"
          value={spec.injPhaseOffset}
          unit="°"
          step={1}
          min={-60}
          max={60}
          hint="Geser EOI terhadap bukaan klep"
          onChange={(v) => updateSpec({ injPhaseOffset: v })}
        />
        <NumField
          label="Offset Bacaan Ignition"
          value={spec.ignBaseOffset}
          unit="°"
          step={1}
          min={-30}
          max={30}
          hint="Manual JUKEN bacaan +9°; set sesuai cara baca di device-mu"
          onChange={(v) => updateSpec({ ignBaseOffset: v })}
        />
      </Section>

      <Section title="Grid Mapping">
        <NumField
          label="Idle RPM"
          value={spec.idleRPM}
          unit="rpm"
          step={100}
          min={500}
          max={4000}
          hint="Idle asli mesin (referensi). Tabel tetap mulai 1000 sesuai format JUKEN"
          onChange={(v) => updateSpec({ idleRPM: v })}
        />
        <NumField
          label="Max RPM"
          value={spec.maxRPM}
          unit="rpm"
          step={500}
          min={4000}
          max={20000}
          hint="Tinggi kolom tabel (format JUKEN 16000; jangan dirubah)"
          warn={issuesByKey.get("maxRPM")}
          onChange={(v) => updateSpec({ maxRPM: v })}
        />
        <NumField
          label="Limiter RPM"
          value={spec.limiterRPM}
          unit="rpm"
          step={500}
          min={0}
          max={20000}
          hint="Batas putaran nyata ECU (0 = ikut Max RPM). Zona AFR WOT tinggi & power peak mengikuti ini"
          onChange={(v) => updateSpec({ limiterRPM: v })}
        />
        <NumField
          label="Step RPM"
          value={spec.rpmStep}
          unit="rpm"
          step={250}
          min={250}
          max={2500}
          onChange={(v) => updateSpec({ rpmStep: v })}
        />
      </Section>

      <Section title="Target AFR (per kondisi)">
        <Text style={styles.notes}>
          Nilai 0 = kosong/belum diisi (fallback ke acuan umum). Range acuan
          tuning 4-tak ditampilkan di hint tiap input.
        </Text>
        <NumField
          label="AFR Idle"
          value={spec.afrIdle}
          unit=":1"
          step={0.1}
          min={10}
          max={17}
          hint="acuan 13.5–13.8"
          warn={issuesByKey.get("afrIdle")}
          onChange={(v) => updateSpec({ afrIdle: v })}
        />
        <NumField
          label="AFR Cruising / Jalan santai"
          value={spec.afrCruise}
          unit=":1"
          step={0.1}
          min={10}
          max={17}
          hint="acuan 13.5–13.8"
          warn={issuesByKey.get("afrCruise")}
          onChange={(v) => updateSpec({ afrCruise: v })}
        />
        <NumField
          label="AFR Akselerasi / Bukaan menengah"
          value={spec.afrAccel}
          unit=":1"
          step={0.1}
          min={10}
          max={17}
          hint="acuan 13.0–13.5"
          warn={issuesByKey.get("afrAccel")}
          onChange={(v) => updateSpec({ afrAccel: v })}
        />
        <NumField
          label="AFR WOT / Beban tinggi"
          value={spec.afrWot}
          unit=":1"
          step={0.1}
          min={10}
          max={17}
          hint="acuan 12.5–13.0"
          warn={issuesByKey.get("afrWot")}
          onChange={(v) => updateSpec({ afrWot: v })}
        />
        <NumField
          label="AFR WOT + RPM tinggi"
          value={spec.afrWotHigh}
          unit=":1"
          step={0.1}
          min={10}
          max={17}
          hint="acuan 12.5–12.8"
          onChange={(v) => updateSpec({ afrWotHigh: v })}
        />
        <Text style={styles.notes}>
          Dipakai untuk menghitung nilai Base Map (Fuel) tiap sel. Setelah
          mengubah AFR, tekan «Generate ulang» di tab Base Map untuk menerapkan.
        </Text>
      </Section>

      <Section title="Catatan">
        <Text style={styles.notes}>
          Semua hasil adalah estimasi berbasis spek. Tabel map otomatis
          menyesuaikan idle–max RPM. HP puncak & MV dihitung dari model VE
          (volumetric efficiency); gunakan sebagai titik awal tuning, bukan
          angka absolut. Kalibrasi akhir tetap dari dyno/afr meter di lapangan.
        </Text>
        <Text style={styles.notes}>
          Power @ torsi puncak: {hpAtTorque.toFixed(1)} HP • Power @ limiter{" "}
          {redlineRPM(spec).toLocaleString("id-ID")} rpm: {hpAtMax.toFixed(1)} HP
        </Text>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.lg, paddingBottom: 40 },
  hero: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.lg
  },
  heroTitle: { color: Colors.text, fontSize: FontSize.xl, fontWeight: "800" },
  heroSub: {
    color: Colors.textDim,
    fontSize: FontSize.sm,
    marginTop: 2,
    marginBottom: Spacing.md
  },
  dropdownWrap: { marginBottom: Spacing.md, position: "relative", zIndex: 10 },
  dropdownBtn: {
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  dropdownText: {
    color: Colors.accent,
    fontSize: FontSize.md,
    fontWeight: "700"
  },
  dropdownCaret: { color: Colors.accent, fontSize: FontSize.xs },
  dropdownMenu: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    marginTop: 4,
    overflow: "hidden",
    zIndex: 20
  },
  dropdownItem: { paddingHorizontal: Spacing.md, paddingVertical: 12 },
  dropdownItemActive: { backgroundColor: Colors.surfaceAlt },
  dropdownItemText: { color: Colors.text, fontSize: FontSize.md },
  dropdownItemTextActive: { color: Colors.accent, fontWeight: "700" },
  nameInput: {
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    color: Colors.text,
    fontSize: FontSize.md
  },
  notes: {
    color: Colors.textDim,
    fontSize: FontSize.xs,
    lineHeight: 16,
    marginBottom: Spacing.sm
  },
  warnRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: Spacing.sm
  },
  warnDanger: {
    backgroundColor: "rgba(231, 76, 60, 0.12)",
    borderColor: "rgba(231, 76, 60, 0.45)"
  },
  warnWarn: {
    backgroundColor: "rgba(241, 196, 15, 0.10)",
    borderColor: "rgba(241, 196, 15, 0.4)"
  },
  warnOk: {
    backgroundColor: "rgba(46, 204, 113, 0.10)",
    borderColor: "rgba(46, 204, 113, 0.4)"
  },
  warnIcon: { fontSize: FontSize.md, fontWeight: "800", marginRight: Spacing.sm },
  warnText: { color: Colors.text, fontSize: FontSize.xs, flex: 1, lineHeight: 16 },
  warnLabel: { color: Colors.danger, fontWeight: "700" },
  hintLine: {
    color: Colors.textDim,
    fontSize: FontSize.xs,
    lineHeight: 16
  }
});
