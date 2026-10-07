/**
 * Kard SVG Illustrations
 * All keyframe colors are hardcoded hex (CSS custom properties don't work
 * inside @keyframes in WebKit / SVG <style> tags).
 */
// @ts-nocheck
import { cn } from "@/lib/utils";

/* ─── colour palette ─────────────────────────────────────────── */
const R  = "#E11D48";   // primary red
const RL = "#F43F5E";   // lighter red
const G  = "#0E7C66";   // healing green
const GL = "#D9F2E6";   // green tint
const AM = "#C77B1E";   // amber / med risk
const BD = "#E4E4E7";   // border / track
const CW = "#FFFFFF";   // card white
const INK= "#1E1B17";   // ink

/* ─── shared reduced-motion query ───────────────────────────── */
const RMQ = "@media(prefers-reduced-motion:reduce)";

/* ═══════════════════════════════════════════════════════════════
   HERO - EKG draw animation
══════════════════════════════════════════════════════════════ */
export const EkgWave = ({ className }: { className?: string }) => {
  const dx = 150;
  const pathD = Array.from({ length: 10 }).map((_, i) => {
    const x = (i - 1) * dx;
    const prefix = i === 0 ? `M${x},80` : `L${x},80`;
    return `${prefix} L${x+10},80 L${x+18},62 L${x+26},108 L${x+34},42 L${x+42},80 L${x+75},80 L${x+82},72 L${x+89},88 L${x+96},65 L${x+104},80 L${x+150},80`;
  }).join(" ");

  return (
    <svg viewBox="0 0 900 160" fill="none" xmlns="http://www.w3.org/2000/svg"
      className={cn("w-full h-auto overflow-hidden", className)}>
      <style>{`
        @keyframes ekgScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-150px); }
        }
        @keyframes ekgGrid { 0%{opacity:0} 20%{opacity:0.35} 70%{opacity:0.35} 100%{opacity:0} }
        .ekg-path { animation: ekgScroll 1.2s linear infinite; }
        .ekg-grid { animation: ekgGrid 3.6s ease-in-out infinite; }
        ${RMQ}{.ekg-path{animation:none;transform:translateX(0);}}
      `}</style>
      {/* faint grid */}
      {[40,80,120].map(y=>(
        <line key={y} className="ekg-grid" x1="0" y1={y} x2="900" y2={y}
          stroke={BD} strokeWidth="0.8" opacity="0"/>
      ))}
      {[100,200,300,400,500,600,700,800].map(x=>(
        <line key={x} className="ekg-grid" x1={x} y1="0" x2={x} y2="160"
          stroke={BD} strokeWidth="0.8" opacity="0"/>
      ))}
      {/* main trace */}
      <g className="ekg-path">
        <path
          d={pathD}
          stroke={R} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </g>
    </svg>
  );
};

/* ═══════════════════════════════════════════════════════════════
   Q1 - Age: Ornate clock
══════════════════════════════════════════════════════════════ */
export const IllusAge = ({ className }: { className?: string }) => {
  const ticks = Array.from({length:60},(_,i)=>i);
  return (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"
    className={cn("w-full h-auto", className)}>
    <style>{`
      @keyframes hr  { to { transform: rotate(360deg); } }
      @keyframes min { to { transform: rotate(360deg); } }
      @keyframes sec { to { transform: rotate(360deg); } }
      @keyframes cp  { 0%,100%{r:3.5} 50%{r:5} }
      /* 10:10 classic watch position:
         hour hand  → 300° (= 10h × 30°), delay = 300/360 × 43200s = 36000s
         minute hand → 60° (= 10min × 6°), delay = 600/3600 × 3600s = 600s
         second hand → 90° (= 15s),         delay = 15s               */
      .ch { transform-origin:100px 100px; animation: hr  43200s linear infinite; animation-delay:-36000s; }
      .cm { transform-origin:100px 100px; animation: min 3600s  linear infinite; animation-delay:-600s; }
      .cs { transform-origin:100px 100px; animation: sec 60s    linear infinite; animation-delay:-15s; }
      .cc { animation: cp 1s ease-in-out infinite; }
      ${RMQ}{.ch,.cm,.cs,.cc{animation:none;}}
    `}</style>
    {/* outer ring */}
    <circle cx="100" cy="100" r="90" fill={CW} stroke={BD} strokeWidth="2"/>
    <circle cx="100" cy="100" r="83" fill="none" stroke={BD} strokeWidth="0.6" strokeDasharray="1 3"/>
    {/* tick marks */}
    {ticks.map(i=>{
      const a=(i*6-90)*Math.PI/180;
      const isMaj=i%5===0;
      const r1=isMaj?72:76, r2=80;
      return <line key={i}
        x1={100+r1*Math.cos(a)} y1={100+r1*Math.sin(a)}
        x2={100+r2*Math.cos(a)} y2={100+r2*Math.sin(a)}
        stroke={isMaj?INK:BD} strokeWidth={isMaj?2:0.8}/>;
    })}
    {/* hour numerals */}
    {[12,1,2,3,4,5,6,7,8,9,10,11].map((n,i)=>{
      const a=(i*30-90)*Math.PI/180;
      return <text key={n}
        x={100+60*Math.cos(a)} y={100+60*Math.sin(a)+4}
        textAnchor="middle" fontSize="10" fill={INK}
        fontFamily="Fraunces, serif" fontWeight="500">{n}</text>;
    })}
    {/* hour hand */}
    <g className="ch">
      <line x1="100" y1="100" x2="100" y2="55" stroke={INK} strokeWidth="5" strokeLinecap="round"/>
    </g>
    {/* minute hand */}
    <g className="cm">
      <line x1="100" y1="106" x2="100" y2="38" stroke={INK} strokeWidth="3.5" strokeLinecap="round"/>
    </g>
    {/* second hand */}
    <g className="cs">
      <line x1="100" y1="118" x2="100" y2="32" stroke={R} strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="100" cy="118" r="3.5" fill={R}/>
    </g>
    {/* center cap */}
    <circle cx="100" cy="100" r="6" fill={INK}/>
    <circle cx="100" cy="100" r="3" fill={CW}/>
    <circle className="cc" cx="100" cy="100" r="4" fill="none" stroke={R} strokeWidth="1"/>
  </svg>
  );
};

/* ═══════════════════════════════════════════════════════════════
   Q2 - Sex: DNA double helix (depth-aware)
══════════════════════════════════════════════════════════════ */
export const IllusSex = ({ className }: { className?: string }) => {
  const STRANDS = 10;
  return (
  <svg viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg"
    className={cn("w-full h-auto", className)}>
    <style>{`
      @keyframes dnaScroll { to { transform: translateY(-${220/STRANDS * 2}px); } }
      .dna-g { animation: dnaScroll ${STRANDS * 0.35}s linear infinite; }
      ${RMQ}{ .dna-g { animation:none; } }
    `}</style>
    <defs>
      <clipPath id="dnaC"><rect x="55" y="10" width="90" height="200"/></clipPath>
      <linearGradient id="g1" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={R} stopOpacity="1"/>
        <stop offset="1" stopColor={R} stopOpacity="0.2"/>
      </linearGradient>
      <linearGradient id="g2" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={G} stopOpacity="0.2"/>
        <stop offset="1" stopColor={G} stopOpacity="1"/>
      </linearGradient>
    </defs>
    <g clipPath="url(#dnaC)" className="dna-g">
      {/* render extra rows to fill clip during scroll */}
      {Array.from({length: STRANDS + 3}, (_, i) => {
        const y = 15 + i * (220 / STRANDS);
        const phase = (i / STRANDS) * Math.PI * 2;
        const lx = 100 + 30 * Math.cos(phase);
        const rx = 100 - 30 * Math.cos(phase);
        const depth = Math.cos(phase); // -1 (back) to 1 (front)
        const rSize = 5 + 2 * Math.abs(depth);
        const leftFront = depth > 0;
        return (
          <g key={i}>
            {/* cross rung */}
            <line x1={lx} y1={y} x2={rx} y2={y}
              stroke={BD} strokeWidth="1.5" strokeDasharray="2 3" opacity="0.7"/>
            {/* strand nodes - depth determines which is in front */}
            {leftFront ? (
              <>
                <circle cx={rx} cy={y} r={rSize - 1} fill="url(#g2)"
                  opacity={0.4 + 0.5 * (1 - Math.abs(depth))}/>
                <circle cx={lx} cy={y} r={rSize} fill="url(#g1)"
                  opacity={0.5 + 0.5 * Math.abs(depth)}/>
              </>
            ) : (
              <>
                <circle cx={lx} cy={y} r={rSize - 1} fill="url(#g1)"
                  opacity={0.4 + 0.5 * (1 - Math.abs(depth))}/>
                <circle cx={rx} cy={y} r={rSize} fill="url(#g2)"
                  opacity={0.5 + 0.5 * Math.abs(depth)}/>
              </>
            )}
          </g>
        );
      })}
    </g>
    {/* backbone lines */}
    <line x1="70" y1="10" x2="70" y2="210" stroke={R} strokeWidth="2" opacity="0.25"/>
    <line x1="130" y1="10" x2="130" y2="210" stroke={G} strokeWidth="2" opacity="0.25"/>
  </svg>
  );
};

/* ═══════════════════════════════════════════════════════════════
   Q3 - Chest pain: torso + beating heart + pain burst
══════════════════════════════════════════════════════════════ */
export const IllusChestPain = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"
    className={cn("w-full h-auto", className)}>
    <style>{`
      @keyframes cpWave {
        0%   { r:9;  opacity:0.9;  stroke-width:2.5; }
        100% { r:50; opacity:0;    stroke-width:0.4; }
      }
      @keyframes cpBeat {
        0%,100% { transform:scale(1);    }
        25%     { transform:scale(1.22); }
        50%     { transform:scale(0.93); }
        75%     { transform:scale(1.09); }
      }
      @keyframes cpGlow {
        0%,100% { opacity:0.07; }
        50%     { opacity:0.22; }
      }
      @keyframes cpBolt {
        0%,100% { opacity:1;   transform:translateY(0px);   }
        50%     { opacity:0.5; transform:translateY(1.5px); }
      }
      .cpw1 { animation: cpWave 2.1s ease-out 0s     infinite; }
      .cpw2 { animation: cpWave 2.1s ease-out 0.7s   infinite; }
      .cpw3 { animation: cpWave 2.1s ease-out 1.4s   infinite; }
      .cph  { transform-origin:82px 100px; animation: cpBeat 1.1s ease-in-out infinite; }
      .cpgl { animation: cpGlow 1.1s ease-in-out infinite; }
      .cplt { transform-origin:100px 90px; animation: cpBolt 1.1s ease-in-out infinite; }
      ${RMQ}{.cpw1,.cpw2,.cpw3,.cph,.cpgl,.cplt{animation:none;}}
    `}</style>
    <defs>
      <radialGradient id="cpGlowGrad" cx="41%" cy="50%">
        <stop offset="0"    stopColor="#E11D48" stopOpacity="0.35"/>
        <stop offset="100%" stopColor="#E11D48" stopOpacity="0"/>
      </radialGradient>
    </defs>

    {/* ── Torso silhouette - stroke only, no white fill ── */}
    {/* Neck */}
    <rect x="90" y="4" width="20" height="18" rx="9"
      fill="none" stroke={BD} strokeWidth="1.8"/>
    {/* Shoulders */}
    <path d="M34,34 Q34,22 58,20 L90,16 L110,16 L142,20 Q166,22 166,34 L156,58 L44,58 Z"
      fill="none" stroke={BD} strokeWidth="1.8"/>
    {/* Trunk */}
    <path d="M44,58 L42,186 Q64,194 100,194 Q136,194 158,186 L156,58 Z"
      fill="none" stroke={BD} strokeWidth="1.8"/>
    {/* Sternum - dashed vertical */}
    <line x1="100" y1="58" x2="100" y2="174"
      stroke={BD} strokeWidth="1" strokeDasharray="3 4" opacity="0.4"/>
    {/* Collarbones */}
    <path d="M90,22 Q74,28 56,36" fill="none" stroke={BD} strokeWidth="1" opacity="0.45"/>
    <path d="M110,22 Q126,28 144,36" fill="none" stroke={BD} strokeWidth="1" opacity="0.45"/>
    {/* Ribcage - 4 pairs of curved ribs */}
    {[0,1,2,3].map(i => {
      const y = 68 + i * 22;
      const op = (0.28 + i * 0.04).toFixed(2);
      return (
        <g key={i} opacity={op}>
          <path d={`M100,${y} Q76,${y+5} 50,${y+14}`}
            fill="none" stroke={BD} strokeWidth="1.3" strokeLinecap="round"/>
          <path d={`M100,${y} Q124,${y+5} 150,${y+14}`}
            fill="none" stroke={BD} strokeWidth="1.3" strokeLinecap="round"/>
        </g>
      );
    })}

    {/* ── Pain glow (pulsing radial) ── */}
    <circle cx="82" cy="100" r="48" fill="url(#cpGlowGrad)" className="cpgl"/>

    {/* ── Radiating pain waves from heart ── */}
    <circle cx="82" cy="100" r="9" fill="none" stroke="#E11D48" strokeWidth="2.5" className="cpw1"/>
    <circle cx="82" cy="100" r="9" fill="none" stroke="#E11D48" strokeWidth="2.5" className="cpw2"/>
    <circle cx="82" cy="100" r="9" fill="none" stroke="#E11D48" strokeWidth="2.5" className="cpw3"/>

    {/* ── Beating heart (anatomically left of center) ── */}
    <g className="cph">
      <path d="M82,117 C82,117 60,100 60,85 C60,73 82,73 82,85 C82,73 104,73 104,85 C104,100 82,117 82,117 Z"
        fill="#E11D48"/>
      <ellipse cx="73" cy="83" rx="6" ry="4" fill="white" opacity="0.22"
        transform="rotate(-20,73,83)"/>
    </g>

    {/* ── Lightning bolt pain indicator (right of heart) ── */}
    <g className="cplt">
      <path d="M103,72 L94,91 L102,91 L92,112 L106,88 L98,88 Z"
        fill="#FFB830" stroke="#C77B1E" strokeWidth="0.7" opacity="0.92"/>
    </g>
  </svg>
);

/* ═══════════════════════════════════════════════════════════════
   Q4 - Blood pressure: Sphygmomanometer
══════════════════════════════════════════════════════════════ */
export const IllusBP = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 200 190" xmlns="http://www.w3.org/2000/svg"
    className={cn("w-full h-auto", className)}>
    <style>{`
      @keyframes bpNeedle {
        0%   { transform: rotate(-130deg); }
        30%  { transform: rotate(-20deg);  }
        50%  { transform: rotate(10deg);   }
        62%  { transform: rotate(5deg);    }
        74%  { transform: rotate(8deg);    }
        100% { transform: rotate(-130deg); }
      }
      @keyframes bpWave {
        0%   { stroke-dashoffset:400; }
        100% { stroke-dashoffset:0;   }
      }
      @keyframes bpGlow { 0%,100%{opacity:0.6} 50%{opacity:1} }
      .bp-n { transform-origin:100px 118px; animation: bpNeedle 3.5s cubic-bezier(.4,0,.6,1) infinite; }
      .bp-w { stroke-dasharray:400; animation: bpWave 3.5s linear infinite; }
      .bp-gl{ animation: bpGlow 3.5s ease-in-out infinite; }
      ${RMQ}{.bp-n,.bp-w,.bp-gl{animation:none;}}
    `}</style>
    <defs>
      <linearGradient id="bpArc" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0"   stopColor={G}/>
        <stop offset="0.5" stopColor={AM}/>
        <stop offset="1"   stopColor={R}/>
      </linearGradient>
    </defs>
    {/* dial face */}
    <path d="M20,118 A80,80 0 0 1 180,118" fill={CW} stroke={BD} strokeWidth="3"/>
    {/* colour arc */}
    <path d="M30,118 A70,70 0 0 1 170,118"
      fill="none" stroke="url(#bpArc)" strokeWidth="8" strokeLinecap="round" opacity="0.75" className="bp-gl"/>
    {/* tick marks */}
    {Array.from({length:9},(_,i)=>{
      const a=(-150+i*37.5)*Math.PI/180;
      const isMaj=i%2===0;
      const r1=isMaj?60:64, r2=70;
      return <line key={i}
        x1={100+r1*Math.cos(a)} y1={118+r1*Math.sin(a)}
        x2={100+r2*Math.cos(a)} y2={118+r2*Math.sin(a)}
        stroke={isMaj?INK:BD} strokeWidth={isMaj?2:1}/>;
    })}
    {/* labels */}
    {[[80,-135],[120,-90],[160,-45],[200,0]].map(([n,deg])=>{
      const a=(deg as number)*Math.PI/180;
      return <text key={n} x={100+55*Math.cos(a)} y={118+55*Math.sin(a)+4}
        textAnchor="middle" fontSize="8" fill={INK} fontFamily="Geist Variable,sans-serif">{n}</text>;
    })}
    <text x="100" y="148" textAnchor="middle" fontSize="8" fill={INK} fontFamily="Geist Variable,sans-serif">mmHg</text>
    {/* needle */}
    <g className="bp-n">
      <line x1="100" y1="124" x2="100" y2="55" stroke={R} strokeWidth="3" strokeLinecap="round"/>
      <circle cx="100" cy="55" r="3" fill={R}/>
    </g>
    <circle cx="100" cy="118" r="9" fill={INK}/>
    <circle cx="100" cy="118" r="4.5" fill={CW}/>
    {/* waveform below */}
    <path className="bp-w"
      d="M10,168 Q18,155 26,168 Q32,177 38,152 Q44,126 50,168
         Q56,186 66,168 Q74,155 82,168 Q88,177 94,152 Q100,126 106,168
         Q112,186 122,168 Q130,155 138,168 Q144,177 150,152 Q156,126 162,168
         Q168,186 178,168 Q186,155 190,168"
      fill="none" stroke={R} strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);

/* ═══════════════════════════════════════════════════════════════
   Q5 - Cholesterol: Artery cross-section with plaque
══════════════════════════════════════════════════════════════ */
export const IllusCholesterol = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"
    className={cn("w-full h-auto", className)}>
    <style>{`
      @keyframes plaq {
        0%   { d: path("M68,68 C68,68 68,68 68,68 Z"); opacity:0.4; }
        60%  { d: path("M68,68 C55,65 50,78 55,90 C60,102 78,106 90,100 C102,94 106,80 98,70 C90,60 76,60 68,68 Z"); opacity:0.85; }
        100% { d: path("M68,68 C55,65 50,78 55,90 C60,102 78,106 90,100 C102,94 106,80 98,70 C90,60 76,60 68,68 Z"); opacity:0.85; }
      }
      @keyframes rbc {
        0%   { transform: translateX(-60px); opacity:0; }
        12%  { opacity:1; }
        88%  { opacity:1; }
        100% { transform: translateX(260px); opacity:0; }
      }
      .plq { animation: plaq 3.5s ease-in-out infinite alternate; }
      .rb1 { animation: rbc 2.8s linear 0s    infinite; }
      .rb2 { animation: rbc 2.8s linear 0.9s  infinite; }
      .rb3 { animation: rbc 2.8s linear 1.8s  infinite; }
      ${RMQ}{.plq,.rb1,.rb2,.rb3{animation:none;}}
    `}</style>
    <defs>
      <radialGradient id="cBg2"><stop offset="0" stopColor={R} stopOpacity="0.08"/><stop offset="1" stopColor={R} stopOpacity="0"/></radialGradient>
      <clipPath id="artClip"><circle cx="100" cy="100" r="65"/></clipPath>
    </defs>
    {/* artery wall */}
    <circle cx="100" cy="100" r="78" fill={BD} opacity="0.5"/>
    <circle cx="100" cy="100" r="68" fill={CW}/>
    {/* plaque */}
    <path className="plq"
      d="M68,68 C55,65 50,78 55,90 C60,102 78,106 90,100 C102,94 106,80 98,70 C90,60 76,60 68,68 Z"
      fill={AM} opacity="0.85"/>
    <circle cx="76" cy="82" r="8" fill={AM} opacity="0.55"/>
    {/* red blood cells flowing */}
    <g clipPath="url(#artClip)">
      <ellipse className="rb1" cx="100" cy="100" rx="10" ry="7" fill={R} opacity="0.9"/>
      <ellipse className="rb1" cx="100" cy="87"  rx="8"  ry="5.5" fill={R} opacity="0.85" style={{animationDelay:"0.3s"}}/>
      <ellipse className="rb2" cx="100" cy="112" rx="9"  ry="6.5" fill={R} opacity="0.9"/>
      <ellipse className="rb3" cx="100" cy="100" rx="7"  ry="5"   fill={RL} opacity="0.8"/>
    </g>
    <text x="100" y="175" textAnchor="middle" fontSize="9" fill={INK} fontFamily="Geist Variable,sans-serif" opacity="0.6">Arterial Cross-section</text>
  </svg>
);

/* ═══════════════════════════════════════════════════════════════
   Q6 - Blood sugar: Droplet with filling animation
══════════════════════════════════════════════════════════════ */
export const IllusBloodSugar = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 200 210" xmlns="http://www.w3.org/2000/svg"
    className={cn("w-full h-auto", className)}>
    <style>{`
      @keyframes dropBob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
      @keyframes fillRise {
        0%   { height:0;  y:165; }
        50%  { height:95; y:70;  }
        100% { height:0;  y:165; }
      }
      @keyframes shimmer {
        0%   { x:62; opacity:0; }
        30%  { opacity:0.6; }
        60%  { x:118; opacity:0; }
        100% { x:118; opacity:0; }
      }
      @keyframes sparkle {
        0%,100%{transform:scale(0) rotate(0deg); opacity:0}
        50%    {transform:scale(1) rotate(180deg); opacity:1}
      }
      .d-body  { animation: dropBob 2.8s ease-in-out infinite; transform-origin:100px 120px; }
      .d-fill  { animation: fillRise 3s ease-in-out infinite; }
      .d-shim  { animation: shimmer 3s ease-in-out infinite; }
      .d-spark { animation: sparkle 2s ease-in-out infinite; transform-origin:center; }
      ${RMQ}{.d-body,.d-fill,.d-shim,.d-spark{animation:none;}}
    `}</style>
    <defs>
      <clipPath id="dClip">
        <path d="M100,42 C100,42 55,95 55,138 C55,164 75,178 100,178 C125,178 145,164 145,138 C145,95 100,42 100,42 Z"/>
      </clipPath>
      <linearGradient id="dFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={RL} stopOpacity="0.7"/>
        <stop offset="1" stopColor={R}  stopOpacity="0.9"/>
      </linearGradient>
    </defs>
    <g className="d-body">
      {/* droplet outline */}
      <path d="M100,42 C100,42 55,95 55,138 C55,164 75,178 100,178 C125,178 145,164 145,138 C145,95 100,42 100,42 Z"
        fill={CW} stroke={R} strokeWidth="3"/>
      {/* filling liquid */}
      <rect className="d-fill" x="57" y="165" width="86" height="0"
        fill="url(#dFill)" clipPath="url(#dClip)"/>
      {/* shimmer highlight */}
      <rect className="d-shim" x="62" y="75" width="12" height="70" rx="6"
        fill="white" opacity="0"/>
      {/* scale line */}
      <line x1="52" y1="120" x2="46" y2="120" stroke={INK} strokeWidth="1.2" opacity="0.4"/>
      <text x="40" y="124" textAnchor="middle" fontSize="8" fill={INK} fontFamily="Geist Variable,sans-serif" opacity="0.5">120</text>
    </g>
    {/* sparkle stars around droplet */}
    {[[32,55],[165,70],[40,155],[168,140]].map(([sx,sy],i)=>(
      <g key={i} className="d-spark" style={{animationDelay:`${i*0.5}s`}}>
        <text x={sx} y={sy} textAnchor="middle" fontSize="10" fill={AM} opacity="0.8">✦</text>
      </g>
    ))}
    <text x="100" y="200" textAnchor="middle" fontSize="9" fill={INK} fontFamily="Geist Variable,sans-serif" opacity="0.5">mg/dL</text>
  </svg>
);

/* ═══════════════════════════════════════════════════════════════
   Q7 - ECG: Paper printout scrolling
══════════════════════════════════════════════════════════════ */
export const IllusECG = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"
    className={cn("w-full h-auto", className)}>
    <style>{`
      @keyframes ecgScroll { to { transform:translateX(-130px); } }
      @keyframes ecgRoll   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(2px)} }
      @keyframes ecgDot    { 0%,100%{r:2;opacity:1} 50%{r:3.5;opacity:0.7} }
      .ecg-tape { animation: ecgScroll 2.4s linear infinite; }
      .ecg-body { animation: ecgRoll 2.4s ease-in-out infinite; transform-origin:100px 100px; }
      .ecg-led  { animation: ecgDot  0.8s ease-in-out infinite; }
      ${RMQ}{.ecg-tape,.ecg-body,.ecg-led{animation:none;}}
    `}</style>
    <defs><clipPath id="ecgCl"><rect x="28" y="44" width="144" height="112"/></clipPath></defs>
    <g className="ecg-body">
      {/* paper */}
      <rect x="26" y="40" width="148" height="120" rx="6" fill={CW} stroke={BD} strokeWidth="2"/>
      {/* header strip */}
      <rect x="26" y="40" width="148" height="16" rx="6" fill={BD} opacity="0.4"/>
      <text x="100" y="52" textAnchor="middle" fontSize="8" fill={INK} fontFamily="Geist Variable,sans-serif" fontWeight="600">Resting ECG</text>
      {/* grid */}
      {[68,82,96,110,124,138].map(y=>(
        <line key={y} x1="30" y1={y} x2="170" y2={y} stroke={GL} strokeWidth="0.7" opacity="0.8"/>
      ))}
      {[45,58,71,84,97,110,123,136,149,162].map(x=>(
        <line key={x} x1={x} y1="57" x2={x} y2="152" stroke={GL} strokeWidth="0.7" opacity="0.8"/>
      ))}
      {/* scrolling trace */}
      <g clipPath="url(#ecgCl)" className="ecg-tape">
        <path d="M-60,100 L-20,100 L-14,85 L-8,126 L-2,68 L4,100 L22,100
           L26,93 L30,107 L34,82 L38,100
           L70,100 L76,85 L82,126 L88,68 L94,100 L112,100
           L116,93 L120,107 L124,82 L128,100
           L160,100 L166,85 L172,126 L178,68 L184,100 L202,100
           L206,93 L210,107 L214,82 L218,100
           L250,100 L256,85 L262,126 L268,68 L274,100 L292,100"
          fill="none" stroke={R} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </g>
    </g>
    {/* activity LED */}
    <circle className="ecg-led" cx="162" cy="48" r="2" fill={G}/>
  </svg>
);

/* ═══════════════════════════════════════════════════════════════
   Q8 - Max heart rate: Tachometer
══════════════════════════════════════════════════════════════ */
export const IllusMaxHR = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 200 185" xmlns="http://www.w3.org/2000/svg"
    className={cn("w-full h-auto", className)}>
    <style>{`
      @keyframes revNeedle {
        0%   { transform: rotate(-138deg); }
        35%  { transform: rotate(62deg);  }
        50%  { transform: rotate(50deg);  }
        65%  { transform: rotate(58deg);  }
        80%  { transform: rotate(52deg);  }
        100% { transform: rotate(-138deg); }
      }
      @keyframes revGlow { 0%,100%{opacity:0.3} 35%,65%{opacity:1} }
      @keyframes speedLine {
        0%   { opacity:0; transform:scaleX(0); }
        40%  { opacity:1; transform:scaleX(1); }
        80%  { opacity:0; transform:scaleX(0); }
        100% { opacity:0; }
      }
      .tn  { transform-origin:100px 118px; animation: revNeedle 3.2s cubic-bezier(.3,0,.7,1) infinite; }
      .tgl { animation: revGlow 3.2s ease-in-out infinite; }
      .sl1 { transform-origin:right center; animation: speedLine 3.2s ease-out 0s    infinite; }
      .sl2 { transform-origin:right center; animation: speedLine 3.2s ease-out 0.1s  infinite; }
      .sl3 { transform-origin:right center; animation: speedLine 3.2s ease-out 0.2s  infinite; }
      ${RMQ}{.tn,.tgl,.sl1,.sl2,.sl3{animation:none;}}
    `}</style>
    <defs>
      <linearGradient id="taArc" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0"    stopColor={G}/>
        <stop offset="0.55" stopColor={AM}/>
        <stop offset="1"    stopColor={R}/>
      </linearGradient>
    </defs>
    {/* dial */}
    <path d="M16,118 A84,84 0 0 1 184,118" fill={CW} stroke={BD} strokeWidth="3"/>
    {/* colour arc */}
    <path d="M28,118 A72,72 0 0 1 172,118"
      fill="none" stroke="url(#taArc)" strokeWidth="10" strokeLinecap="round" className="tgl"/>
    {/* tick marks */}
    {Array.from({length:13},(_,i)=>{
      const a=(-150+i*25)*Math.PI/180;
      const maj=i%2===0;
      const r1=maj?60:65, r2=72;
      return <line key={i}
        x1={100+r1*Math.cos(a)} y1={118+r1*Math.sin(a)}
        x2={100+r2*Math.cos(a)} y2={118+r2*Math.sin(a)}
        stroke={maj?INK:BD} strokeWidth={maj?2:1}/>;
    })}
    {/* speed lines */}
    <line className="sl1" x1="28" y1="90" x2="52" y2="90" stroke={R} strokeWidth="1.5" opacity="0"/>
    <line className="sl2" x1="22" y1="100" x2="48" y2="100" stroke={R} strokeWidth="1" opacity="0"/>
    <line className="sl3" x1="28" y1="110" x2="50" y2="110" stroke={R} strokeWidth="1.5" opacity="0"/>
    {/* labels */}
    {[[60,-138],[100,-108],[140,-78],[180,-48],[220,0]].map(([n,deg])=>{
      const a=(deg as number)*Math.PI/180;
      return <text key={n} x={100+55*Math.cos(a)} y={118+55*Math.sin(a)+4}
        textAnchor="middle" fontSize="8" fill={INK} fontFamily="Geist Variable,sans-serif">{n}</text>;
    })}
    <text x="100" y="142" textAnchor="middle" fontSize="8" fill={INK} fontFamily="Geist Variable,sans-serif">bpm</text>
    {/* needle */}
    <g className="tn">
      <line x1="100" y1="122" x2="100" y2="52" stroke={R} strokeWidth="3.5" strokeLinecap="round"/>
      <circle cx="100" cy="52" r="3" fill={R}/>
    </g>
    <circle cx="100" cy="118" r="10" fill={INK}/>
    <circle cx="100" cy="118" r="5" fill={CW}/>
  </svg>
);

/* ═══════════════════════════════════════════════════════════════
   Q9 - Exercise angina: Figure climbing stairs with heart
══════════════════════════════════════════════════════════════ */
export const IllusAngina = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"
    className={cn("w-full h-auto", className)}>
    <style>{`
      @keyframes climb {
        0%,100% { transform:translate(0,0); }
        48%     { transform:translate(0,-3px); }
        50%     { transform:translate(40px,-40px); }
        98%     { transform:translate(40px,-43px); }
      }
      @keyframes hbeat {
        0%,100%{transform:scale(1);} 30%{transform:scale(1.2);} 60%{transform:scale(0.95);}
      }
      @keyframes stepFlash { 0%,100%{opacity:1} 50%{opacity:0.4} }
      .cl-fig   { animation: climb 2.6s cubic-bezier(.4,0,.6,1) infinite; }
      .cl-heart { transform-origin:68px 28px; animation: hbeat 1.3s ease-in-out infinite; }
      .cl-step  { animation: stepFlash 2.6s ease-in-out infinite; }
      ${RMQ}{.cl-fig,.cl-heart,.cl-step{animation:none;}}
    `}</style>
    {/* stairs */}
    <path d="M18,185 L18,155 L58,155 L58,125 L98,125 L98,95 L138,95 L138,65 L182,65 L182,185 Z"
      fill={CW} stroke={BD} strokeWidth="2.5"/>
    {/* step highlights */}
    <line className="cl-step" x1="18" y1="155" x2="58" y2="155" stroke={R} strokeWidth="1.5" opacity="0.5"/>
    <line className="cl-step" x1="58" y1="125" x2="98" y2="125" stroke={R} strokeWidth="1.5" opacity="0.5" style={{animationDelay:"0.2s"}}/>
    <line className="cl-step" x1="98" y1="95" x2="138" y2="95" stroke={R} strokeWidth="1.5" opacity="0.5" style={{animationDelay:"0.4s"}}/>
    {/* figure */}
    <g className="cl-fig">
      <g className="cl-heart">
        <path d="M68,20 C68,20 58,14 58,8 C58,3 68,3 68,8 C68,3 78,3 78,8 C78,14 68,20 68,20 Z"
          fill={R}/>
      </g>
      {/* head */}
      <circle cx="68" cy="38" r="10" fill={INK} opacity="0.7"/>
      {/* body */}
      <line x1="68" y1="48" x2="68" y2="72" stroke={INK} strokeWidth="3" strokeLinecap="round" opacity="0.7"/>
      {/* arms */}
      <line x1="68" y1="55" x2="52" y2="67" stroke={INK} strokeWidth="2.5" strokeLinecap="round" opacity="0.7"/>
      <line x1="68" y1="55" x2="84" y2="63" stroke={INK} strokeWidth="2.5" strokeLinecap="round" opacity="0.7"/>
      {/* legs */}
      <line x1="68" y1="72" x2="58" y2="90" stroke={INK} strokeWidth="2.5" strokeLinecap="round" opacity="0.7"/>
      <line x1="68" y1="72" x2="80" y2="88" stroke={INK} strokeWidth="2.5" strokeLinecap="round" opacity="0.7"/>
    </g>
    <line x1="18" y1="185" x2="182" y2="185" stroke={BD} strokeWidth="2"/>
  </svg>
);

/* ═══════════════════════════════════════════════════════════════
   Q10 - ST depression: EKG with highlighted ST zone
══════════════════════════════════════════════════════════════ */
export const IllusSTDepression = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"
    className={cn("w-full h-auto", className)}>
    <style>{`
      @keyframes stScroll { to { transform:translateX(-130px); } }
      @keyframes stPulse  { 0%,100%{opacity:0.15;transform:scaleY(1)} 50%{opacity:0.35;transform:scaleY(1.08)} }
      @keyframes stLabel  { 0%,100%{opacity:0.5} 50%{opacity:1} }
      .st-tape  { animation: stScroll 2.4s linear infinite; }
      .st-band  { transform-origin:100px 105px; animation: stPulse 1.2s ease-in-out infinite; }
      .st-lbl   { animation: stLabel 1.2s ease-in-out infinite; }
      ${RMQ}{.st-tape,.st-band,.st-lbl{animation:none;}}
    `}</style>
    <rect x="20" y="38" width="160" height="124" rx="8" fill={CW} stroke={BD} strokeWidth="2"/>
    {/* grid */}
    {[60,76,92,108,124,140].map(y=>(
      <line key={y} x1="28" y1={y} x2="172" y2={y} stroke={GL} strokeWidth="0.6" opacity="0.9"/>
    ))}
    {/* ST highlight band */}
    <rect className="st-band" x="28" y="88" width="144" height="34" fill={R} opacity="0.15" rx="2"/>
    {/* ST label */}
    <text className="st-lbl" x="170" y="108" textAnchor="end" fontSize="8"
      fill={R} fontFamily="Geist Variable,sans-serif" fontWeight="700">ST↓</text>
    {/* scrolling trace */}
    <defs><clipPath id="stCl"><rect x="22" y="40" width="156" height="120"/></clipPath></defs>
    <g clipPath="url(#stCl)" className="st-tape">
      <path d="M-60,100 L-15,100 L-9,82 L-3,128 L3,65 L9,100 L28,100
         L32,113 L36,100
         L70,100 L76,82 L82,128 L88,65 L94,100 L112,100
         L116,113 L120,100
         L160,100 L166,82 L172,128 L178,65 L184,100 L202,100
         L206,113 L210,100 L250,100"
        fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.85"/>
      {/* ST segment highlighted in red */}
      <path d="M28,100 L32,113 L36,100 M116,100 L120,113 L124,100 M204,100 L208,113 L212,100"
        fill="none" stroke={R} strokeWidth="2.5" strokeLinecap="round"/>
    </g>
  </svg>
);

/* ═══════════════════════════════════════════════════════════════
   Q11 - ST slope: Animated slope graph
══════════════════════════════════════════════════════════════ */
export const IllusSTSlope = ({ className }: any) => {
  return (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"
    className={cn("w-full h-auto", className)}>
    <style>{`
      @keyframes sUp   { 0%,20%{opacity:0} 25%,75%{opacity:1} 80%,100%{opacity:0} }
      @keyframes sFlat { 0%,45%{opacity:0} 50%,83%{opacity:1} 88%,100%{opacity:0} }
      @keyframes sDwn  { 0%,65%{opacity:0} 70%,95%{opacity:1} 100%{opacity:0} }
      @keyframes dotTravel {
        0%   { offset-distance:0%;   opacity:0; }
        5%   { opacity:1; }
        95%  { opacity:1; }
        100% { offset-distance:100%; opacity:0; }
      }
      .sl-up   { animation: sUp   3.6s ease-in-out infinite; }
      .sl-flat { animation: sFlat 3.6s ease-in-out infinite; }
      .sl-dwn  { animation: sDwn  3.6s ease-in-out infinite; }
      ${RMQ}{.sl-up,.sl-flat,.sl-dwn{animation:none;opacity:1;}}
    `}</style>
    {/* axes */}
    <line x1="40" y1="168" x2="40"  y2="30"  stroke={BD} strokeWidth="2.5"/>
    <line x1="40" y1="168" x2="175" y2="168" stroke={BD} strokeWidth="2.5"/>
    <text x="38" y="28" textAnchor="end" fontSize="9" fill={INK} fontFamily="Geist Variable,sans-serif">mV</text>
    <text x="178" y="172" fontSize="9" fill={INK} fontFamily="Geist Variable,sans-serif">t</text>
    {/* Y tick lines */}
    {[60,90,120,150].map(y=>(
      <line key={y} x1="36" y1={y} x2="170" y2={y} stroke={BD} strokeWidth="0.6" strokeDasharray="4 4"/>
    ))}
    {/* Upsloping */}
    <g className="sl-up">
      <line x1="55" y1="148" x2="160" y2="55" stroke={G} strokeWidth="3.5" strokeLinecap="round"/>
      <circle cx="160" cy="55" r="5" fill={G}/>
      <text x="165" y="52" fontSize="9" fill={G} fontFamily="Geist Variable,sans-serif" fontWeight="700">Up</text>
    </g>
    {/* Flat */}
    <g className="sl-flat">
      <line x1="55" y1="110" x2="160" y2="110" stroke={AM} strokeWidth="3.5" strokeLinecap="round"/>
      <circle cx="160" cy="110" r="5" fill={AM}/>
      <text x="165" y="114" fontSize="9" fill={AM} fontFamily="Geist Variable,sans-serif" fontWeight="700">Flat</text>
    </g>
    {/* Downsloping */}
    <g className="sl-dwn">
      <line x1="55" y1="62" x2="160" y2="148" stroke={R} strokeWidth="3.5" strokeLinecap="round"/>
      <circle cx="160" cy="148" r="5" fill={R}/>
      <text x="165" y="152" fontSize="9" fill={R} fontFamily="Geist Variable,sans-serif" fontWeight="700">Down</text>
    </g>
  </svg>
  );
};

/* ═══════════════════════════════════════════════════════════════
   Q12 - Blocked vessels: Coronary artery tree
══════════════════════════════════════════════════════════════ */
export const IllusVessels = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"
    className={cn("w-full h-auto", className)}>
    <style>{`
      @keyframes vFlow {
        0%  { stroke-dashoffset:220; }
        100%{ stroke-dashoffset:0;   }
      }
      @keyframes blockPulse { 0%,100%{transform:scale(1);opacity:0.7} 50%{transform:scale(1.12);opacity:1} }
      @keyframes bLabel     { 0%,100%{opacity:0.6} 50%{opacity:1} }
      .v-f1 { stroke-dasharray:220; animation: vFlow 2.2s linear 0s    infinite; }
      .v-f2 { stroke-dasharray:220; animation: vFlow 2.2s linear 0.35s  infinite; }
      .v-f3 { stroke-dasharray:220; animation: vFlow 2.2s linear 0.7s   infinite; }
      .v-f4 { stroke-dasharray:220; animation: vFlow 2.2s linear 0.55s  infinite; }
      .v-blk{ transform-origin:60px 130px; animation: blockPulse 1.4s ease-in-out infinite; }
      .v-lbl{ animation: bLabel 1.4s ease-in-out infinite; }
      ${RMQ}{.v-f1,.v-f2,.v-f3,.v-f4{animation:none;stroke-dashoffset:0;} .v-blk,.v-lbl{animation:none;}}
    `}</style>
    {/* vessel walls (thick grey) */}
    <path d="M100,22 L100,72"            fill="none" stroke={BD} strokeWidth="14" strokeLinecap="round"/>
    <path d="M100,72 Q68,80 52,115"      fill="none" stroke={BD} strokeWidth="11" strokeLinecap="round"/>
    <path d="M100,72 Q132,80 148,115"    fill="none" stroke={BD} strokeWidth="11" strokeLinecap="round"/>
    <path d="M52,115 Q48,138 52,162"     fill="none" stroke={BD} strokeWidth="9"  strokeLinecap="round"/>
    <path d="M148,115 Q152,138 148,162"  fill="none" stroke={BD} strokeWidth="9"  strokeLinecap="round"/>
    {/* blood flow inside */}
    <path className="v-f1" d="M100,22 L100,72" fill="none" stroke={R} strokeWidth="7" strokeLinecap="round"/>
    <path className="v-f2" d="M100,72 Q68,80 52,115" fill="none" stroke={R} strokeWidth="5" strokeLinecap="round"/>
    <path className="v-f3" d="M100,72 Q132,80 148,115" fill="none" stroke={R} strokeWidth="5" strokeLinecap="round"/>
    <path className="v-f4" d="M148,115 Q152,138 148,162" fill="none" stroke={R} strokeWidth="4" strokeLinecap="round"/>
    {/* blockage indicator */}
    <g className="v-blk">
      <ellipse cx="60" cy="130" rx="13" ry="10" fill={AM} opacity="0.85"/>
      <text x="60" y="134" textAnchor="middle" fontSize="11" fill={CW} fontWeight="bold" fontFamily="Geist Variable,sans-serif">×</text>
    </g>
    <text className="v-lbl" x="80" y="130" fontSize="8" fill={AM} fontFamily="Geist Variable,sans-serif" fontWeight="700">Blockage</text>
    {/* heart at top */}
    <path d="M100,12 C100,12 90,6 90,0 C90,-5 100,-5 100,0 C100,-5 110,-5 110,0 C110,6 100,12 100,12 Z"
      fill={R} opacity="0.85" transform="translate(0,20) scale(1.1)"/>
  </svg>
);

/* ═══════════════════════════════════════════════════════════════
   Q13 - Thalassemia: Blood cells in vessel (normal + sickle)
══════════════════════════════════════════════════════════════ */
export const IllusThalassemia = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"
    className={cn("w-full h-auto", className)}>
    <style>{`
      @keyframes rbcFlow {
        0%   { transform:translateX(-65px); opacity:0; }
        8%   { opacity:1; }
        90%  { opacity:1; }
        100% { transform:translateX(265px); opacity:0; }
      }
      @keyframes sickleWobble {
        0%,100%{ transform:rotate(0deg); }
        50%    { transform:rotate(12deg); }
      }
      .rbc-n1 { animation: rbcFlow 3s linear 0s   infinite; }
      .rbc-n2 { animation: rbcFlow 3s linear 1s   infinite; }
      .rbc-n3 { animation: rbcFlow 3s linear 2s   infinite; }
      .rbc-s  { animation: rbcFlow 3s linear 0.5s infinite; }
      .rbc-sw { transform-origin:center; animation: sickleWobble 1.5s ease-in-out infinite; }
      ${RMQ}{.rbc-n1,.rbc-n2,.rbc-n3,.rbc-s,.rbc-sw{animation:none; transform:none; opacity:1; }}
    `}</style>
    <defs><clipPath id="vcl"><rect x="14" y="64" width="172" height="72"/></clipPath></defs>
    {/* vessel */}
    <path d="M10,66 Q10,48 26,48 L174,48 Q190,48 190,66 L190,134 Q190,152 174,152 L26,152 Q10,152 10,134 Z"
      fill={CW} stroke={BD} strokeWidth="4"/>
    {/* flowing normal RBCs */}
    <g clipPath="url(#vcl)">
      <g className="rbc-n1">
        <ellipse cx="40" cy="100" rx="14" ry="9" fill={R} opacity="0.9"/>
        <ellipse cx="40" cy="100" rx="7"  ry="4" fill={RL} opacity="0.45"/>
      </g>
      <g className="rbc-n2">
        <ellipse cx="40" cy="88"  rx="12" ry="8" fill={R} opacity="0.85"/>
        <ellipse cx="40" cy="88"  rx="6"  ry="3.5" fill={RL} opacity="0.4"/>
      </g>
      <g className="rbc-n3">
        <ellipse cx="40" cy="113" rx="13" ry="8.5" fill={R} opacity="0.9"/>
        <ellipse cx="40" cy="113" rx="6.5" ry="3.5" fill={RL} opacity="0.4"/>
      </g>
      {/* sickle cell */}
      <g className="rbc-s">
        <g className="rbc-sw">
          <path d="M40,98 Q52,90 58,97 Q64,104 56,112 Q48,119 40,112 Q30,106 40,98 Z"
            fill={AM} opacity="0.92"/>
        </g>
      </g>
    </g>
    <text x="100" y="175" textAnchor="middle" fontSize="9" fill={INK} fontFamily="Geist Variable,sans-serif" opacity="0.55">Sickle-cell variant (amber)</text>
  </svg>
);

/* ═══════════════════════════════════════════════════════════════
   Results: Risk ring fill
══════════════════════════════════════════════════════════════ */
export const RiskRingSVG = ({ value, color, className }: { value: number; color: string; className?: string }) => {
  const R2 = 42;
  const circ = 2 * Math.PI * R2;
  const offset = circ - (value / 100) * circ;
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"
      className={cn("w-full h-full -rotate-90", className)}>
      <style>{`
        @keyframes ringFill {
          from { stroke-dashoffset: ${circ}; }
          to   { stroke-dashoffset: ${offset}; }
        }
        .risk-r {
          stroke-dasharray: ${circ};
          stroke-dashoffset: ${offset};
          animation: ringFill 2.2s cubic-bezier(0.4,0,0.2,1) forwards;
        }
        ${RMQ}{ .risk-r { animation:none; } }
      `}</style>
      <circle cx="50" cy="50" r={R2} fill="none" stroke={BD} strokeWidth="9"/>
      <circle cx="50" cy="50" r={R2} fill="none" stroke={color}
        strokeWidth="9" strokeLinecap="round" className="risk-r"/>
    </svg>
  );
};

/* ═══════════════════════════════════════════════════════════════
   flowstate additions, drawn in the same palette and style
══════════════════════════════════════════════════════════════ */

/* Smoking: a cigarette with a glowing tip and rising smoke */
export const IllusSmoking = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" className={cn("w-full h-full", className)}>
    <style>{`
      @keyframes smokeRise { 0%{transform:translateY(0) scaleX(1);opacity:0} 25%{opacity:.7} 100%{transform:translateY(-46px) scaleX(1.5);opacity:0} }
      @keyframes emberGlow { 0%,100%{fill:${R}} 50%{fill:#FB923C} }
      .smk { transform-box: fill-box; transform-origin: center bottom; animation: smokeRise 3.2s ease-out infinite; }
      .smk2 { animation-delay: 1.05s; } .smk3 { animation-delay: 2.1s; }
      .ember { animation: emberGlow 1.6s ease-in-out infinite; }
      ${RMQ}{ .smk,.ember{animation:none;} .smk{opacity:.5} }
    `}</style>
    {[0, 1, 2].map((i) => (
      <path key={i} className={`smk ${i === 1 ? "smk2" : i === 2 ? "smk3" : ""}`}
        d={`M${118 + i * 4} 92 C ${110 + i * 4} 80, ${128 + i * 4} 72, ${118 + i * 4} 60`}
        stroke="#B9B2A8" strokeWidth="3" strokeLinecap="round" />
    ))}
    <rect x="22" y="94" width="104" height="18" rx="3" fill={CW} stroke={INK} strokeWidth="2.5" />
    <rect x="22" y="94" width="30" height="18" rx="3" fill={AM} opacity="0.85" stroke={INK} strokeWidth="2.5" />
    {[30, 38, 46].map((x) => <circle key={x} cx={x} cy={103} r="1.4" fill={CW} opacity="0.7" />)}
    <rect className="ember" x="120" y="94" width="8" height="18" rx="2" fill={R} />
    <line x1="20" y1="124" x2="140" y2="124" stroke={BD} strokeWidth="2" strokeLinecap="round" />
  </svg>
)

/* Wall motion: an echo (ultrasound) slice of the left ventricle; the wall contracts, one segment hardly moves */
export const IllusWallMotion = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" className={cn("w-full h-full", className)}>
    <style>{`
      @keyframes lvSqueeze { 0%,100%{transform:scale(1)} 40%{transform:scale(0.82)} }
      @keyframes stillPulse { 0%,100%{opacity:1} 50%{opacity:.55} }
      .lv { transform-box: view-box; transform-origin: 80px 92px; animation: lvSqueeze 1.4s ease-in-out infinite; }
      .stiff { animation: stillPulse 1.4s ease-in-out infinite; }
      ${RMQ}{ .lv,.stiff{animation:none;} }
    `}</style>
    {/* ultrasound fan */}
    <path d="M80 18 L136 132 Q80 150 24 132 Z" fill={BD} opacity="0.55" />
    <path d="M80 18 L136 132 Q80 150 24 132 Z" stroke={INK} strokeOpacity="0.25" strokeWidth="1.5" />
    {[52, 76, 100, 124].map((y) => <path key={y} d={`M${80 - (y - 18) * 0.49} ${y} Q80 ${y + 10} ${80 + (y - 18) * 0.49} ${y}`} stroke={INK} strokeOpacity="0.08" strokeWidth="1" />)}
    {/* contracting ventricle wall (most of the ring) */}
    <g className="lv">
      <path d="M80 62 A30 30 0 1 1 51.5 101.3" stroke={INK} strokeWidth="9" strokeLinecap="round" />
    </g>
    {/* the segment that does not move */}
    <path className="stiff" d="M51.5 101.3 A30 30 0 0 1 80 62" stroke={R} strokeWidth="9" strokeLinecap="round" />
    <circle cx="80" cy="18" r="4" fill={INK} opacity="0.5" />
  </svg>
)

/* Ejection fraction: the pump-strength dial (Kard's dial, rescaled to %; low is red, normal is green) */
export const IllusEjection = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 200 185" xmlns="http://www.w3.org/2000/svg" className={cn("w-full h-auto", className)}>
    <style>{`
      @keyframes efNeedle { 0%{transform:rotate(-120deg)} 40%{transform:rotate(42deg)} 55%{transform:rotate(30deg)} 70%{transform:rotate(38deg)} 85%{transform:rotate(33deg)} 100%{transform:rotate(-120deg)} }
      @keyframes efGlow { 0%,100%{opacity:0.35} 40%,75%{opacity:1} }
      .efn { transform-origin:100px 118px; animation: efNeedle 3.4s cubic-bezier(.3,0,.7,1) infinite; }
      .efg { animation: efGlow 3.4s ease-in-out infinite; }
      ${RMQ}{.efn,.efg{animation:none;} .efn{transform:rotate(33deg)}}
    `}</style>
    <defs>
      <linearGradient id="efArc" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={R}/><stop offset="0.45" stopColor={AM}/><stop offset="0.75" stopColor={G}/><stop offset="1" stopColor={G}/>
      </linearGradient>
    </defs>
    <path d="M16,118 A84,84 0 0 1 184,118" fill={CW} stroke={BD} strokeWidth="3"/>
    <path d="M28,118 A72,72 0 0 1 172,118" fill="none" stroke="url(#efArc)" strokeWidth="10" strokeLinecap="round" className="efg"/>
    {Array.from({ length: 9 }, (_, i) => {
      const a = (-180 + i * 22.5) * Math.PI / 180, maj = i % 2 === 0, r1 = maj ? 60 : 65
      return <line key={i} x1={100 + r1 * Math.cos(a)} y1={118 + r1 * Math.sin(a)} x2={100 + 72 * Math.cos(a)} y2={118 + 72 * Math.sin(a)}
        stroke={maj ? INK : BD} strokeWidth={maj ? 2 : 1}/>
    })}
    {[[0, -180], [20, -135], [40, -90], [60, -45], [80, 0]].map(([n, deg]) => {
      const a = (deg as number) * Math.PI / 180
      return <text key={n} x={100 + 50 * Math.cos(a)} y={118 + 50 * Math.sin(a) + 4} textAnchor="middle" fontSize="8" fill={INK} fontFamily="Geist Variable,sans-serif">{n}</text>
    })}
    <text x="100" y="142" textAnchor="middle" fontSize="8" fill={INK} fontFamily="Geist Variable,sans-serif">% pumped out</text>
    <g className="efn">
      <line x1="100" y1="122" x2="100" y2="52" stroke={R} strokeWidth="3.5" strokeLinecap="round"/>
      <circle cx="100" cy="52" r="3" fill={R}/>
    </g>
    <circle cx="100" cy="118" r="10" fill={INK}/>
    <circle cx="100" cy="118" r="5" fill={CW}/>
  </svg>
)
