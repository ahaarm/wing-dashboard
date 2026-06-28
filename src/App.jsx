import { useState, useEffect, useMemo } from "react";
import { Wind, Navigation2, AlertTriangle, Loader2, ChevronLeft, ChevronRight, Droplets, X } from "lucide-react";

const KMH_TO_KTS = 1 / 1.852;
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6);
const DATES = Array.from({ length: 13 }, (_, i) => {
  const d = new Date(2026, 6, 2 + i);
  return d.toISOString().slice(0, 10);
});

const COEFF = {
  "2026-07-02": [71,72], "2026-07-03": [72,71], "2026-07-04": [70,69],
  "2026-07-05": [68,66], "2026-07-06": [64,61], "2026-07-07": [59,56],
  "2026-07-08": [54,54], "2026-07-09": [52,52], "2026-07-10": [52,53],
  "2026-07-11": [56,60], "2026-07-12": [65,70], "2026-07-13": [76,81],
  "2026-07-14": [86,90],
};

const SPOTS = [
  { id:"goulien", name:"Goulien", zone:"crozon", type:"wave", windGroup:"crozon",
    windDirs:[[180,315]], tideRule:"pm", tideTh:0.42, notes:"Reef peu profond à BM" },
  { id:"roscanvel", name:"Roscanvel", zone:"crozon", type:"flat", windGroup:"crozon",
    windDirs:[[0,360]], tideRule:"always", notes:"Rade de Brest · toujours profond" },
  { id:"dossen", name:"Le Dossen", zone:"nord", type:"wave", windGroup:"nord_e",
    windDirs:[[190,340]], tideRule:"pm", tideTh:0.52, notes:"⚠ Algues été · PM only" },
  { id:"conquet", name:"Le Conquet", zone:"nord", type:"wave", windGroup:"nord_w",
    windDirs:[[200,340]], tideRule:"bm", tideTh:0.55, notes:"BM → mi-marée (inverse Dossen)" },
  { id:"amiets", name:"Amiets", zone:"nord", type:"mixed", windGroup:"nord_e",
    windDirs:[[280,360],[0,45]], tideRule:"always", notes:"Aucune contrainte marée" },
  { id:"keremma", name:"Keremma", zone:"nord", type:"flat", windGroup:"nord_e",
    windDirs:[[280,360],[0,70]], tideRule:"almost", tideTh:0.15, notes:"Flat · N/NE/NW only" },
  { id:"trois_m", name:"3 Moutons", zone:"nord", type:"wave", windGroup:"nord_w",
    windDirs:[[260,350]], tideRule:"pm", tideTh:0.38, notes:"⚠ Engagé au large · PM" },
  { id:"carantec", name:"Carantec", zone:"nord", type:"flat", windGroup:"nord_e",
    windDirs:[[0,360]], tideRule:"always", notes:"Repli safe · baie de Morlaix" },
];

const CROZON_SPOTS = SPOTS.filter(s => s.zone === "crozon");
const NORD_SPOTS = SPOTS.filter(s => s.zone === "nord");

const WIND_GROUPS = {
  crozon:  { lat: 48.2233, lon: -4.5452 },
  nord_w:  { lat: 48.3681, lon: -4.7598 },
  nord_e:  { lat: 48.7105, lon: -4.0332 },
};

const TE = [
  ["2026-07-02T01:21",1.77,"L"],["2026-07-02T07:16",6.18,"H"],["2026-07-02T13:34",1.93,"L"],["2026-07-02T19:33",6.46,"H"],
  ["2026-07-03T01:56",1.75,"L"],["2026-07-03T07:51",6.18,"H"],["2026-07-03T14:09",1.93,"L"],["2026-07-03T20:09",6.43,"H"],
  ["2026-07-04T02:31",1.77,"L"],["2026-07-04T08:26",6.14,"H"],["2026-07-04T14:45",1.98,"L"],["2026-07-04T20:45",6.35,"H"],
  ["2026-07-05T03:08",1.84,"L"],["2026-07-05T09:04",6.05,"H"],["2026-07-05T15:24",2.07,"L"],["2026-07-05T21:25",6.23,"H"],
  ["2026-07-06T03:48",1.95,"L"],["2026-07-06T09:45",5.94,"H"],["2026-07-06T16:06",2.20,"L"],["2026-07-06T22:09",6.07,"H"],
  ["2026-07-07T04:33",2.10,"L"],["2026-07-07T10:32",5.80,"H"],["2026-07-07T16:55",2.35,"L"],["2026-07-07T22:59",5.90,"H"],
  ["2026-07-08T05:24",2.26,"L"],["2026-07-08T11:28",5.69,"H"],["2026-07-08T17:52",2.47,"L"],
  ["2026-07-09T00:00",5.77,"H"],["2026-07-09T06:25",2.37,"L"],["2026-07-09T12:33",5.66,"H"],["2026-07-09T18:59",2.50,"L"],
  ["2026-07-10T01:08",5.74,"H"],["2026-07-10T07:33",2.37,"L"],["2026-07-10T13:44",5.75,"H"],["2026-07-10T20:12",2.37,"L"],
  ["2026-07-11T02:21",5.84,"H"],["2026-07-11T08:44",2.24,"L"],["2026-07-11T14:55",5.99,"H"],["2026-07-11T21:24",2.09,"L"],
  ["2026-07-12T03:33",6.08,"H"],["2026-07-12T09:52",1.98,"L"],["2026-07-12T16:02",6.34,"H"],["2026-07-12T22:29",1.71,"L"],
  ["2026-07-13T04:37",6.40,"H"],["2026-07-13T10:54",1.67,"L"],["2026-07-13T17:02",6.71,"H"],["2026-07-13T23:28",1.32,"L"],
  ["2026-07-14T05:34",6.69,"H"],["2026-07-14T11:49",1.38,"L"],["2026-07-14T17:56",7.03,"H"],
].map(([t,h,type]) => ({ t: new Date(t+":00+02:00").getTime(), h, type }));

function getTide(ts) {
  let before = TE[0], after = TE[1];
  for (let i = 0; i < TE.length - 1; i++) {
    if (TE[i].t <= ts && TE[i+1].t > ts) { before = TE[i]; after = TE[i+1]; break; }
  }
  if (ts >= TE[TE.length-1].t) { before = TE[TE.length-2]; after = TE[TE.length-1]; }
  const p = Math.max(0, Math.min(1, (ts - before.t) / (after.t - before.t)));
  const cos = (1 - Math.cos(Math.PI * p)) / 2;
  const height = before.h + (after.h - before.h) * cos;
  const rising = after.type === "H";
  const phase = rising ? cos : 1 - cos;
  return { height: Math.round(height*100)/100, phase, rising };
}

function getDayTideEvents(dateStr) {
  const dayStart = new Date(dateStr + "T00:00:00+02:00").getTime();
  const dayEnd = new Date(dateStr + "T23:59:59+02:00").getTime();
  return TE.filter(e => e.t >= dayStart && e.t <= dayEnd);
}

function dirInRange(d, ranges) {
  return ranges.some(([a,b]) => a <= b ? (d >= a && d <= b) : (d >= a || d <= b));
}

const DIR_LABELS = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
function dirLabel(deg) { return DIR_LABELS[Math.round(((deg % 360)+360)%360 / 22.5) % 16]; }

function score(spot, wSpd, wDir, wGust, tide) {
  const kts = Math.round(wSpd * KMH_TO_KTS);
  const gustKts = Math.round(wGust * KMH_TO_KTS);
  let w = kts < 8 ? 0 : kts < 12 ? 1 : kts <= 25 ? 2 : kts <= 32 ? 1 : 0;
  if (gustKts > 35) w = Math.max(0, w - 1);
  if (w === 0) return { level: 0, reason: kts < 8 ? "no_wind" : "too_much", kts, gustKts, dir: dirLabel(wDir) };
  const dirOk = dirInRange(wDir, spot.windDirs);
  let tideOk = true;
  if (spot.tideRule === "pm") tideOk = tide.phase >= (spot.tideTh || 0.45);
  else if (spot.tideRule === "bm") tideOk = tide.phase <= (spot.tideTh || 0.55);
  else if (spot.tideRule === "almost") tideOk = tide.phase >= (spot.tideTh || 0.15);
  let level = 2;
  let reason = "go";
  if (!dirOk && !tideOk) { level = 0; reason = "dir_tide"; }
  else if (!dirOk) { level = 0; reason = "wrong_dir"; }
  else if (!tideOk) { level = 0; reason = "wrong_tide"; }
  else if (w === 1) { level = 1; reason = "marginal"; }
  return { level, reason, kts, gustKts, dir: dirLabel(wDir), dirDeg: wDir };
}

const CELL_COLORS = {
  2: "bg-emerald-400", 1: "bg-amber-300",
  0: "bg-slate-200",
  "no_wind": "bg-slate-100", "too_much": "bg-red-300",
  "wrong_dir": "bg-orange-200", "wrong_tide": "bg-sky-200",
  "dir_tide": "bg-slate-200",
};

function cellColor(s) {
  if (s.level === 2) return CELL_COLORS[2];
  if (s.level === 1) return CELL_COLORS[1];
  return CELL_COLORS[s.reason] || CELL_COLORS[0];
}

function cellBorder(s) {
  if (s.level === 2) return "ring-1 ring-emerald-600/30";
  if (s.level === 1) return "ring-1 ring-amber-500/30";
  return "";
}

async function fetchWind(group, startDate, endDate) {
  const { lat, lon } = WIND_GROUPS[group];
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m&timezone=Europe%2FParis&start_date=${startDate}&end_date=${endDate}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  const map = {};
  data.hourly.time.forEach((t, i) => {
    map[t] = {
      speed: data.hourly.wind_speed_10m[i] || 0,
      dir: data.hourly.wind_direction_10m[i] || 0,
      gust: data.hourly.wind_gusts_10m[i] || 0,
      model: "GFS/ICON",
    };
  });
  return map;
}

async function fetchWindHD(group, startDate, endDate) {
  try {
    const { lat, lon } = WIND_GROUPS[group];
    const url = `https://api.open-meteo.com/v1/meteofrance?models=arome_france_hd&latitude=${lat}&longitude=${lon}&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m&timezone=Europe%2FParis&start_date=${startDate}&end_date=${endDate}`;
    const res = await fetch(url);
    if (!res.ok) return {};
    const data = await res.json();
    const map = {};
    data.hourly.time.forEach((t, i) => {
      if (data.hourly.wind_speed_10m[i] != null) {
        map[t] = {
          speed: data.hourly.wind_speed_10m[i],
          dir: data.hourly.wind_direction_10m[i] || 0,
          gust: data.hourly.wind_gusts_10m[i] || 0,
          model: "AROME HD",
        };
      }
    });
    return map;
  } catch {
    return {};
  }
}

function TideCurve({ dateStr }) {
  const dayStart = new Date(dateStr + "T06:00:00+02:00").getTime();
  const dayEnd = new Date(dateStr + "T22:00:00+02:00").getTime();
  const points = [];
  const W = 680, H = 56, PAD = 0;
  for (let i = 0; i <= 64; i++) {
    const ts = dayStart + (i / 64) * (dayEnd - dayStart);
    const t = getTide(ts);
    const x = PAD + (i / 64) * (W - 2*PAD);
    const y = H - PAD - ((t.height - 1) / 6) * (H - 2*PAD);
    points.push(`${x},${y}`);
  }
  const events = getDayTideEvents(dateStr);
  return (
    <div className="relative mt-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-14">
        <defs>
          <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.25"/>
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.05"/>
          </linearGradient>
        </defs>
        <polygon points={`${PAD},${H} ${points.join(" ")} ${W-PAD},${H}`} fill="url(#tg)"/>
        <polyline points={points.join(" ")} fill="none" stroke="#0284c7" strokeWidth="2" strokeLinejoin="round"/>
        {events.map((e, i) => {
          const frac = (e.t - dayStart) / (dayEnd - dayStart);
          if (frac < 0 || frac > 1) return null;
          const x = PAD + frac * (W - 2*PAD);
          const y = H - PAD - ((e.h - 1) / 6) * (H - 2*PAD);
          const label = `${new Date(e.t).getHours()}h${String(new Date(e.t).getMinutes()).padStart(2,"0")}`;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="3" fill={e.type==="H"?"#0284c7":"#64748b"}/>
              <text x={x} y={e.type==="H" ? y-7 : y+13} textAnchor="middle"
                    className="text-[9px] font-medium" fill={e.type==="H"?"#0284c7":"#64748b"}>
                {e.type==="H"?"PM":"BM"} {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function WindArrow({ deg, size=12 }) {
  return (
    <div style={{ transform: `rotate(${deg}deg)`, width: size, height: size }}
         className="inline-flex items-center justify-center">
      <Navigation2 size={size} className="text-slate-600" strokeWidth={2.5}/>
    </div>
  );
}

function DetailPanel({ data, spot, onClose }) {
  if (!data) return null;
  const { kts, gustKts, dir, dirDeg, reason, level } = data.score;
  const { height, rising } = data.tide;
  const reasonLabels = {
    go: "GO", marginal: "Vent marginal", no_wind: "Pas de vent",
    too_much: "Trop de vent", wrong_dir: "Mauvaise orientation",
    wrong_tide: "Marée défavorable", dir_tide: "Direction + marée"
  };
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 bg-white border-t border-slate-200 shadow-2xl rounded-t-2xl p-4 pb-6 max-w-lg mx-auto">
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="font-semibold text-sm text-slate-800">{spot.name} · {data.hour}h00</div>
          <div className="text-xs text-slate-500">{spot.notes}</div>
        </div>
        <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100"><X size={18}/></button>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-slate-50 rounded-xl p-3">
          <Wind size={16} className="mx-auto mb-1 text-slate-500"/>
          <div className="text-lg font-bold text-slate-800">{kts}<span className="text-xs font-normal"> kts</span></div>
          <div className="text-xs text-slate-500">rafales {gustKts} kts</div>
          <div className="flex items-center justify-center gap-1 mt-1">
            <WindArrow deg={dirDeg} size={14}/>
            <span className="text-xs font-medium text-slate-600">{dir}</span>
          </div>
        </div>
        <div className="bg-slate-50 rounded-xl p-3">
          <Droplets size={16} className="mx-auto mb-1 text-sky-500"/>
          <div className="text-lg font-bold text-slate-800">{height}<span className="text-xs font-normal">m</span></div>
          <div className="text-xs text-slate-500">{rising ? "▲ montante" : "▼ descendante"}</div>
        </div>
        <div className={`rounded-xl p-3 ${level===2?"bg-emerald-50":level===1?"bg-amber-50":"bg-slate-50"}`}>
          <div className={`text-lg font-bold ${level===2?"text-emerald-700":level===1?"text-amber-700":"text-slate-500"}`}>
            {reasonLabels[reason] || reason}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {reason==="wrong_tide" && (spot.tideRule==="pm"?"Attendre PM":"Attendre BM")}
            {reason==="wrong_dir" && "Vent pas dans l'axe"}
            {reason==="no_wind" && "< 8 kts"}
          </div>
        </div>
      </div>
      {data.model && (
        <div className="text-[10px] text-slate-400 text-center mt-2">Modèle : {data.model}</div>
      )}
    </div>
  );
}

function SpotRow({ spot, dayScores, onCellClick }) {
  return (
    <div className="flex items-center mb-1 group">
      <div className="w-20 shrink-0 pr-2 text-right">
        <div className="text-[11px] font-semibold text-slate-700 leading-tight truncate">{spot.name}</div>
        <div className="text-[9px] text-slate-400">
          {spot.type==="wave"?"🌊":spot.type==="flat"?"🟦":"🏖"}
          {spot.tideRule==="pm"?" PM":spot.tideRule==="bm"?" BM":""}
        </div>
      </div>
      <div className="flex-1 flex gap-px">
        {dayScores.map((s, i) => (
          <button key={i}
            onClick={() => onCellClick(s, spot, i)}
            className={`flex-1 h-7 rounded-sm transition-all cursor-pointer
              ${cellColor(s)} ${cellBorder(s)}
              hover:scale-y-125 hover:z-10 relative`}
            title={`${HOURS[i]}h: ${s.kts} kts ${s.dir}`}>
            {s.level === 2 && (
              <span className="text-[8px] font-bold text-emerald-800 absolute inset-0 flex items-center justify-center">
                {s.kts}
              </span>
            )}
            {s.level === 1 && (
              <span className="text-[8px] font-medium text-amber-700 absolute inset-0 flex items-center justify-center">
                {s.kts}
              </span>
            )}
            {s.level === 0 && s.reason === "wrong_tide" && s.kts >= 10 && (
              <span className="text-[8px] font-medium text-sky-600 absolute inset-0 flex items-center justify-center">
                {s.kts}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function WingDashboard() {
  const [wind, setWind] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selDate, setSelDate] = useState(() => {
    const today = new Date().toISOString().slice(0,10);
    if (DATES.includes(today)) return today;
    const future = DATES.find(d => d >= today);
    return future || DATES[0];
  });
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const groups = Object.keys(WIND_GROUPS);
        const [standard, hd] = await Promise.all([
          Promise.all(groups.map(g => fetchWind(g, DATES[0], DATES[DATES.length-1]))),
          Promise.all(groups.map(g => fetchWindHD(g, DATES[0], DATES[DATES.length-1]))),
        ]);
        if (cancelled) return;
        const map = {};
        groups.forEach((g, i) => {
          map[g] = { ...standard[i] };
          Object.entries(hd[i]).forEach(([key, val]) => {
            map[g][key] = val;
          });
        });
        setWind(map);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const scores = useMemo(() => {
    if (!wind) return null;
    const result = {};
    DATES.forEach(date => {
      result[date] = {};
      SPOTS.forEach(spot => {
        result[date][spot.id] = HOURS.map(h => {
          const key = `${date}T${String(h).padStart(2,"0")}:00`;
          const w = wind[spot.windGroup]?.[key];
          const ts = new Date(key + ":00+02:00").getTime();
          const tide = getTide(ts);
          if (!w) return { level: -1, reason: "no_data", kts:0, gustKts:0, dir:"?", tide };
          const s = score(spot, w.speed, w.dir, w.gust, tide);
          return { ...s, tide, hour: h, model: w.model };
        });
      });
    });
    return result;
  }, [wind]);

  const bestSpots = useMemo(() => {
    if (!scores) return {};
    const result = {};
    DATES.forEach(date => {
      let best = [];
      SPOTS.forEach(spot => {
        const dayScores = scores[date][spot.id];
        const goHours = dayScores.filter(s => s.level === 2).map(s => s.hour);
        if (goHours.length > 0) {
          const avgKts = Math.round(goHours.reduce((sum, h) => {
            const idx = h - 6;
            return sum + (dayScores[idx]?.kts || 0);
          }, 0) / goHours.length);
          best.push({ spot: spot.name, zone: spot.zone, hours: goHours, avgKts, type: spot.type });
        }
      });
      best.sort((a, b) => b.hours.length - a.hours.length);
      result[date] = best.slice(0, 4);
    });
    return result;
  }, [scores]);

  const dayCoeff = COEFF[selDate] || [0,0];
  const dayLabel = new Date(selDate + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });

  const dayModel = useMemo(() => {
    if (!scores) return null;
    const firstSpot = SPOTS[0];
    const dayScores = scores[selDate]?.[firstSpot.id] || [];
    const models = dayScores.map(s => s.model).filter(Boolean);
    if (models.includes("AROME HD")) return "AROME HD 1.5 km";
    return "GFS/ICON";
  }, [scores, selDate]);

  const prevDate = () => { const i = DATES.indexOf(selDate); if (i > 0) { setSelDate(DATES[i-1]); setDetail(null); }};
  const nextDate = () => { const i = DATES.indexOf(selDate); if (i < DATES.length-1) { setSelDate(DATES[i+1]); setDetail(null); }};

  const handleCellClick = (s, spot, i) => {
    setDetail({ score: s, spot, hour: HOURS[i], tide: s.tide, model: s.model });
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-20">
      {/* HEADER */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏄</span>
              <span className="font-bold text-sm tracking-tight">Wing Dashboard</span>
            </div>
            <div className="text-xs text-slate-400">Open-Meteo + SHOM</div>
          </div>
        </div>
        {/* DATE PICKER */}
        <div className="max-w-2xl mx-auto px-1 pb-2">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {DATES.map(d => {
              const dt = new Date(d + "T12:00:00");
              const wd = dt.toLocaleDateString("fr-FR", { weekday: "narrow" });
              const day = dt.getDate();
              const isSel = d === selDate;
              return (
                <button key={d} onClick={() => { setSelDate(d); setDetail(null); }}
                  className={`flex flex-col items-center px-2 py-1 rounded-xl min-w-[40px] transition-all
                    ${isSel ? "bg-slate-800 text-white shadow-lg scale-105" : "hover:bg-slate-100"}`}>
                  <span className={`text-[10px] ${isSel?"text-slate-300":"text-slate-400"}`}>{wd}</span>
                  <span className={`text-sm font-bold ${isSel?"":"text-slate-700"}`}>{day}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-3 pt-3">
        {/* DAY HEADER */}
        <div className="flex items-center justify-between mb-2">
          <button onClick={prevDate} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400">
            <ChevronLeft size={18}/>
          </button>
          <div className="text-center">
            <div className="font-bold text-base capitalize">{dayLabel}</div>
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500 mt-0.5">
              <span>Coeff {dayCoeff[0]}/{dayCoeff[1]}</span>
              {dayModel && <span className="text-[10px] text-slate-400">· {dayModel}</span>}
            </div>
          </div>
          <button onClick={nextDate} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400">
            <ChevronRight size={18}/>
          </button>
        </div>

        {/* BEST RECOMMENDATION */}
        {bestSpots[selDate]?.length > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 mb-3">
            <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1">Meilleur(s) créneau(x)</div>
            {bestSpots[selDate].map((b, i) => {
              const ranges = [];
              let start = b.hours[0];
              for (let j = 1; j <= b.hours.length; j++) {
                if (j === b.hours.length || b.hours[j] !== b.hours[j-1]+1) {
                  ranges.push(`${start}h–${b.hours[j-1]+1}h`);
                  if (j < b.hours.length) start = b.hours[j];
                }
              }
              return (
                <div key={i} className="text-xs text-emerald-800 flex items-center gap-1.5">
                  <span>{b.type==="wave"?"🌊":b.type==="flat"?"🟦":"🏖"}</span>
                  <span className="font-semibold">{b.spot}</span>
                  <span className="text-emerald-600">{ranges.join(", ")}</span>
                  <span className="text-emerald-500">~{b.avgKts} kts</span>
                </div>
              );
            })}
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Loader2 size={28} className="animate-spin mb-2"/>
            <span className="text-sm">Chargement prévisions...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <AlertTriangle size={20} className="mx-auto mb-1 text-red-400"/>
            <div className="text-sm text-red-700">Erreur API : {error}</div>
            <div className="text-xs text-red-500 mt-1">Vérifiez votre connexion et rechargez</div>
          </div>
        )}

        {scores && (
          <>
            {/* HOUR HEADER */}
            <div className="flex items-center mb-1">
              <div className="w-20 shrink-0"/>
              <div className="flex-1 flex">
                {HOURS.map(h => (
                  <div key={h} className="flex-1 text-center text-[9px] text-slate-400 font-medium">
                    {h%2===0 ? `${h}` : ""}
                  </div>
                ))}
              </div>
            </div>

            {/* CROZON */}
            <div className="text-[10px] text-teal-600 mb-1 uppercase tracking-wider font-semibold">Presqu'île de Crozon</div>
            {CROZON_SPOTS.map(spot => (
              <SpotRow key={spot.id} spot={spot} dayScores={scores[selDate]?.[spot.id] || []} onCellClick={handleCellClick}/>
            ))}

            {/* FINISTÈRE NORD */}
            <div className="text-[10px] text-blue-600 mt-3 mb-1 uppercase tracking-wider font-semibold">Finistère Nord</div>
            {NORD_SPOTS.map(spot => (
              <SpotRow key={spot.id} spot={spot} dayScores={scores[selDate]?.[spot.id] || []} onCellClick={handleCellClick}/>
            ))}

            {/* TIDE CURVE */}
            <div className="mt-3 bg-white rounded-xl border border-slate-200 px-3 py-2">
              <div className="flex items-center gap-1 mb-1">
                <Droplets size={12} className="text-sky-500"/>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Marée (Brest)</span>
              </div>
              <TideCurve dateStr={selDate}/>
            </div>

            {/* LEGEND — COLORS */}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-500">
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-emerald-400"/> GO (≥12 kts)</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-amber-300"/> 8–11 kts</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-sky-200"/> Marée ✗</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-orange-200"/> Direction ✗</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-slate-100"/> &lt;8 kts</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-red-300"/> &gt;30 kts</div>
            </div>

            {/* LEGEND — SPOT SYMBOLS */}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-500 pb-4">
              <div className="flex items-center gap-1">🌊 Vague / reef</div>
              <div className="flex items-center gap-1">🟦 Flat water</div>
              <div className="flex items-center gap-1">🏖 Mixte</div>
              <div className="flex items-center gap-1"><span className="font-semibold">PM</span> Mi-montante → pleine mer</div>
              <div className="flex items-center gap-1"><span className="font-semibold">BM</span> Basse mer → mi-marée</div>
            </div>
          </>
        )}
      </div>

      {/* DETAIL PANEL */}
      {detail && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setDetail(null)}/>
          <DetailPanel data={detail} spot={detail.spot} onClose={() => setDetail(null)}/>
        </>
      )}

      <style>{`.no-scrollbar::-webkit-scrollbar{display:none} .no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}`}</style>
    </div>
  );
}
