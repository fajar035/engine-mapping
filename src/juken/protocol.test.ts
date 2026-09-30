import {
  JUKEN_ROWS, JUKEN_COLS, JUKEN_TPS, JUKEN_RPMS,
  encodeRowWrite, encodeRowRead, encodeExecute, encodeDumpVariables,
  LineFramer, parseLine, diffMaps, toEcuGrid, MAP_IDS, MAP_COLS, MAP_RPMS, RowCollector, isJukenMapKey,
} from './protocol';
import { JukenSession } from './client';
import { ECU_IGNITION_RPMS, copyAll } from '../copy';
type Transport = {
  readonly kind: 'bt' | 'wifi';
  readonly label: string;
  send(line: string): Promise<void>;
  onLines(handler: (lines: string[]) => void): () => void;
  disconnect(): Promise<void>;
};

let fail = 0;
function ok(name: string, cond: boolean, extra = '') {
  if (cond) console.log(`  PASS ${name}`);
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
}

console.log('== grid ==');
ok('21 TPS', JUKEN_ROWS === 21, `${JUKEN_ROWS}`);
ok('61 RPM', JUKEN_COLS === 61, `${JUKEN_COLS}`);
ok('TPS tanpa 95', !JUKEN_TPS.includes(95 as never));
ok('RPM 1000..16000', JUKEN_RPMS[0] === 1000 && JUKEN_RPMS[60] === 16000);

console.log('== encode ==');
const row = Array.from({ length: 61 }, (_, i) => 1 + i * 0.01);
const line = encodeRowWrite('baseMap', '42', 0, row);
ok('prefix 2601;42;0', line.startsWith('2601;42;0;'), line.slice(0, 20));
ok('61 nilai', line.trimEnd().split(';').length === 64, `${line.trimEnd().split(';').length}`);
ok('akhir CRLF', line.endsWith('\r\n'));
ok('tanpa eksponensial', !/e/i.test(line));
ok('2 desimal', line.includes('1.00') && line.includes('1.60'));
ok('read row', encodeRowRead('ignition', '7', 20) === '1605;7;20\r\n');
ok('execute', encodeExecute() === '5009\r\n');
ok('dump', encodeDumpVariables() === '1607\r\n');
let threw = false;
try { encodeRowWrite('baseMap', '1', 0, [1, 2]); } catch { threw = true; }
ok('tolak kolom kurang', threw);
threw = false;
try { encodeRowWrite('baseMap', '1', 21, row); } catch { threw = true; }
ok('tolak baris >20', threw);

console.log('== framer ==');
const f = new LineFramer();
const res = f.push('1A00;9601;2.00');
ok('split ;', JSON.stringify(res) === '["1A00","9601"]', JSON.stringify(res));
ok('nilai terakhir tertahan', JSON.stringify(f.flush()) === '["2.00"]');
const f2 = new LineFramer();
ok('CRLF dipecah', f2.push('1A00\r\n9601;1.5').length === 2);
const f3 = new LineFramer();
f3.push('9601;1.0');
ok('fragmen digabung', f3.push(';2.0').length === 1);
const f4 = new LineFramer();
ok('banyak sekaligus', f4.push('a;b\nc;d\n').length === 4);

console.log('== parse ==');
ok('ack', parseLine('1A00').kind === 'ack');
ok('baris penuh', (() => { const p = parseLine('9601;' + Array.from({length:61},(_,i)=>i+1).join(';')); return p.kind === 'data' && p.map === 'baseMap' && p.values.length === 61; })());
ok('baris parsial -> bukan data', parseLine('9601;1.00;2.00').kind !== 'data');
ok('nilai', parseLine('12345').kind === 'value');
ok('kode', (() => { const p = parseLine('9600'); return p.kind === 'code'; })());
ok('map keys', ['baseMap','fuel','injectorTiming','ignition'].every(isJukenMapKey));
ok('kode konsisten', MAP_IDS.baseMap.write.slice(1) === MAP_IDS.baseMap.read.slice(1) && MAP_IDS.baseMap.data.slice(1) === MAP_IDS.baseMap.read.slice(1));

console.log('== collector (stream ECU) ==');
const rc = new RowCollector();
ok('kode saja -> null', rc.push('9601') === null);
for (let i = 0; i < 60; i++) rc.push(String(1 + i));
ok('61 nilai -> data', (() => { const r = rc.push('62.00'); return !!r && r.kind === 'data' && r.kind === 'data' && (r as {values:number[]}).values.length === 61; })());
const rc2 = new RowCollector();
rc2.push('9605');
let ig = null;
for (let i = 0; i < 31; i++) { const r = rc2.push(String(10 + i)); if (r) ig = r; }
ok('ignition 31 kolom', !!ig && (ig as any).map === 'ignition' && (ig as any).values.length === 31, JSON.stringify((ig as any)?.values?.length));
ok('MAP_COLS', MAP_COLS.ignition === 31 && MAP_COLS.baseMap === 61);
ok('MAP_RPMS ignition step500', MAP_RPMS.ignition[1] - MAP_RPMS.ignition[0] === 500 && MAP_RPMS.ignition[30] === 16000);

console.log('== diffMaps ==');
const a = Array.from({length:21},()=>Array.from({length:61},()=>1.5));
const b = a.map(r=>r.slice());
ok('sama', diffMaps(a,b).mismatches === 0);
const c = a.map(r=>r.slice()); c[3][4] = 9;
const d = diffMaps(a,c);
ok('beda terdeteksi', d.mismatches === 1 && d.firstMismatch!.includes('baris 3'), JSON.stringify(d));

// ===== simulasi ECU =====
class FakeEcu implements Transport {
  readonly kind = 'bt' as const; readonly label = 'fake';
  handlers: ((l: string[])=>void)[] = [];
  written: string[] = [];
  map = Array.from({length:21},()=>Array.from({length:61},(_,i)=>1.00+i*0.10));
  delay = 0;
  constructor(private mode: 'ok'|'dropRow5'|'noExec' = 'ok') {}
  send(line: string): Promise<void> {
    this.written.push(line);
    const push = (s: string) => { this.emit(this.framer.push(s)); };
    const [head, addr, rowIdx] = line.trim().split(';');
    if (head === '1607') {
      const vars = Array.from({length: 40}, (_, i) => String(100 + i));
      vars[24] = '77'; vars[25] = '78'; vars[26] = '79'; vars[27] = '80';
      for (const v of vars) push(v + ';');
      return Promise.resolve();
    }
    if (head === '5009') { this.emit(this.framer.push('OK')); return Promise.resolve(); }
    if (/^2\d\d\d$/.test(head)) {
      if (this.mode === 'dropRow5' && Number(rowIdx) === 5) return Promise.resolve();
      push('1A00;');
      return Promise.resolve();
    }
    if (/^1\d\d\d$/.test(head)) {
      // ECU asli mengirim kode dulu, lalu tiap nilai sebagai token terpisah.
      const r = Number(rowIdx);
      const key = /1602/.test(head) ? 'fuel' : /1603/.test(head) ? 'injectorTiming' : /1605/.test(head) ? 'ignition' : 'baseMap';
      const cols = MAP_COLS[key];
      push(MAP_IDS[key].data + ';');
      for (let i = 0; i < cols; i++) push(this.map[r][i].toFixed(2) + ';');
      return Promise.resolve();
    }
    void addr;
    return Promise.resolve();
  }
  onLines(h: (l: string[]) => void) { this.handlers.push(h); return () => { this.handlers = this.handlers.filter(x=>x!==h); }; }
  async disconnect() {}
  private framer = new LineFramer();
  private emit(l: string[]) { for (const h of this.handlers) h(l); }
  /** simulasi potongan data tidak rapi (Bluetooth/TCP) */
  emitChunk(chunk: string) { this.emit(this.framer.push(chunk)); }
}

async function main() {
  console.log('== resample ke grid ECU ==');
const appAxis = Array.from({length:61},(_,i)=>1000+i*250);
// peta app linear 10..70 di 1000rpm, +0.5 per kolom
const appGrid = Array.from({length:21},()=>appAxis.map((_,c)=>10+c*0.5));
const bm = toEcuGrid('baseMap', appGrid, appAxis);
ok('base tetap 61', bm[0].length === 61);
ok('base identik', Math.abs(bm[0][0]-10) < 1e-9 && Math.abs(bm[0][60]-40) < 1e-9, `${bm[0][0]},${bm[0][60]}`);
const ig = toEcuGrid('ignition', appGrid, appAxis);
ok('ignition jadi 31', ig[0].length === 31 && ig.length === 21);
ok('ignition kolom0 = 10', Math.abs(ig[0][0]-10) < 1e-9, `${ig[0][0]}`);
ok('ignition kolom1 (1500rpm) = 11', Math.abs(ig[0][1]-11) < 1e-6, `${ig[0][1]}`);
ok('ignition kolom30 (16000rpm) = 40', Math.abs(ig[0][30]-40) < 1e-9, `${ig[0][30]}`);
// axis app lebih kasar dari ECU: 1000 step 500 -> 31 kolom, ECU 31 kolom
const coarse = Array.from({length:31},(_,i)=>1000+i*500);
const ig2 = toEcuGrid('ignition', coarse.map(()=>coarse.map((_,c)=>c)), coarse);
ok('axis sama panjang', ig2[0].length === 31 && ig2[0][10] === 10, `${ig2[0][10]}`);
// clipping di luar jangkauan
const ig3 = toEcuGrid('ignition', Array.from({length:21},()=>[5,6]), [1000,1250]);
ok('clipping aman', ig3[0].length === 31 && ig3[0][30] === 6);
// tidak boleh menulis ke baris hilang
let t3=false; try { toEcuGrid('baseMap', appGrid.slice(0,10), appAxis); } catch { t3=true; }
ok('tolak peta kurang baris', t3);
// diffMaps pakai kolom peta
const ecuIg31 = Array.from({length:21},()=>Array.from({length:31},(_,i)=>i));
ok('diffMaps ignition 31 kolom', diffMaps(ecuIg31, ecuIg31, 'ignition').mismatches === 0);

console.log('== session: baca alamat ==');
  const ecu = new FakeEcu();
  const s = new JukenSession(ecu);
  const { addresses } = await s.readAddresses();
  ok('b_c1=77', addresses.baseMap === '77', addresses.baseMap);
  ok('f_c1=78', addresses.fuel === '78', addresses.fuel);
  ok('it_c1=79', addresses.injectorTiming === '79');
  ok('ig_c1=80', addresses.ignition === '80');

  console.log('== session: baca peta ==');
  const read = await s.readMap('baseMap', '77');
  ok('21 baris', read.length === 21);
  ok('61 kolom', read[0].length === 61);
  ok('nilai benar', read[0][0] === 1.0 && read[0][1] === 1.1, `${read[0][0]},${read[0][1]}`);

  console.log('== session: baca ignition (31 kolom) ==');
  const ecuIg = new FakeEcu();
  ecuIg.map = Array.from({length:21},()=>Array.from({length:31},(_,i)=>10+i));
  const sIg = new JukenSession(ecuIg);
  const igMap = await sIg.readMap('ignition','80');
  ok('21x31', igMap.length === 21 && igMap[0].length === 31, `${igMap[0]?.length}`);

  console.log('== session: tulis peta ==');
  const target = Array.from({length:21},(_,r)=>Array.from({length:61},(_,c)=>2.00+r*0.01+c*0.001));
  let prog = 0;
  await s.writeMap('baseMap', '77', target, () => prog++);
  ok('21 baris terkirim', prog === 21, `${prog}`);
  ok('21 perintah tulis', ecu.written.filter(w=>w.startsWith('2601;')).length === 21);
  const last = ecu.written.filter(w=>w.startsWith('2601;')).at(-1)!;
  ok('baris terakhir idx 20', last.startsWith('2601;77;20;'), last.slice(0,14));

  console.log('== session: execute ==');
  await s.execute();
  ok('5009 terkirim', ecu.written.at(-1) === '5009\r\n');

  console.log('== session: ECU tidak ACK -> timeout ==');
  const ecu2 = new FakeEcu('dropRow5');
  const s2 = new JukenSession(ecu2, { timeoutMs: 250 });
  let caught = '';
  try { await s2.writeMap('baseMap', '77', target); } catch (e) { caught = (e as Error).message; }
  ok('ditolak dgn pesan jelas', /Timeout/.test(caught), caught);
  await s2.disconnect();

  console.log('== session: petakan tidak lengkap -> tolak sebelum kirim ==');
  const ecu3 = new FakeEcu();
  const s3 = new JukenSession(ecu3);
  const bad = target.map(r=>r.slice()); bad[7] = bad[7].slice(0, 10);
  let caught2 = '';
  try { await s3.writeMap('baseMap', '77', bad); } catch (e) { caught2 = (e as Error).message; }
  ok('ditolak', /belum lengkap/.test(caught2), caught2);
  ok('hanya 7 baris yg terkirim', ecu3.written.filter(w=>w.startsWith('2601;')).length === 7, `${ecu3.written.filter(w=>w.startsWith('2601;')).length}`);

  console.log('== session: framing terputus-parah ==');
  const ecu4 = new FakeEcu();
  const s4 = new JukenSession(ecu4, { timeoutMs: 500 });
  ecu4.map = Array.from({length:21},()=>Array.from({length:61},(_,i)=>1.00+i*0.10));
  const p = s4.readRow('baseMap','77',3).catch(e => { throw e; });
  // fragmentasikan baris jadi potongan aneh
  setTimeout(() => {
    const full = '9601;' + ecu4.map[3].map(v=>v.toFixed(2)).join(';') + ';\r\n';
    for (let i=0;i<full.length;i+=7) ecu4.emitChunk(full.slice(i,i+7));
  }, 20);
  const rowv = await p;
  ok('baris pulih dari potongan', rowv.length === 61 && rowv[0] === 1.0);

  // ===== export: grid ECU harus ikut saat paste =====
  console.log('== export grid ECU ==');
  ok(
    'ECU_IGNITION_RPMS 31 kolom step500',
    ECU_IGNITION_RPMS.length === 31 &&
      ECU_IGNITION_RPMS[1] - ECU_IGNITION_RPMS[0] === 500 &&
      ECU_IGNITION_RPMS[30] === 16000,
  );

  let out = '';
  // peta app: timing linear 20 + 0.1 per kolom 250rpm
  const ignGrid = Array.from({ length: 21 }, () =>
    appAxis.map((_, c) => 20 + c * 0.1),
  );
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Clipboard = require('expo-clipboard');
  Clipboard.setStringAsync = async (s: string) => { out = s; };
  const ecuIgn = toEcuGrid('ignition', ignGrid, appAxis);
  await copyAll(
    ECU_IGNITION_RPMS,
    Array.from({ length: 21 }, (_, i) => i),
    (r, c) => ecuIgn[r][c].toFixed(1),
  );
  const lines = out.trim().split('\n');
  ok('21 baris', lines.length === 21, `${lines.length}`);
  const cols = lines[0].split('\t');
  ok('31 kolom per baris', cols.length === 31, `${cols.length}`);
  ok('kolom0 (1000rpm) = 20.0', cols[0] === '20.0', cols[0]);
  ok('kolom1 (1500rpm) = 20.2', cols[1] === '20.2', cols[1]);
  ok('kolom30 (16000rpm) = 26.0', cols[30] === '26.0', cols[30]);
  ok('tidak ada kolom berlebih', cols.every((c) => c !== ''));

  // Invarian kelas-bug ini: setiap jalur export harus menghasilkan jumlah
  // kolom ECU yang tepat per peta. Tidak boleh bergantung pada ingatan.
  for (const m of ['baseMap', 'ignition'] as const) {
    const src = Array.from({ length: 21 }, () => appAxis.map((_, c) => c));
    const eq = toEcuGrid(m, src, appAxis);
    ok(`${m} grid ECU ${MAP_COLS[m]} kolom`, eq[0].length === MAP_COLS[m]);
    let pasted = '';
    Clipboard.setStringAsync = async (s: string) => {
      pasted = s;
    };
    await copyAll(
      m === 'ignition' ? ECU_IGNITION_RPMS : appAxis,
      Array.from({ length: 21 }, (_, i) => i),
      (r, c) => eq[r][c].toFixed(1),
    );
    const ls = pasted.trim().split('\n');
    ok(
      `${m} paste ${MAP_COLS[m]} kolom`,
      ls.length === 21 && ls[0].split('\t').length === MAP_COLS[m],
      `${ls.length} baris x ${ls[0].split('\t').length} kolom`,
    );
  }

  console.log(
    fail === 0 ? '\nSEMUA LULUS' : `\n${fail} GAGAL`,
  );
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => {
  console.error('ERROR', e);
  process.exit(1);
});
