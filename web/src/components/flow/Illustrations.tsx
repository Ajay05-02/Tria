// The question illustrations: one drawing per question, showing only what that question asks about, in the manner
// of a patient leaflet. They share one look (ink line, soft tints, rose for the subject) and take their colours
// and motion from the `.illus` rules in index.css. Every loop either runs at a steady pace or eases back and
// forth, so none has a visible restart, and all of them hold still under "reduce motion".
import { useMemo, type ReactNode } from "react"
import { cn } from "@/lib/utils"

// `value` is the number being entered, for the one drawing that responds to it
type Props = { className?: string; value?: number | "" }
const motion = !window.matchMedia("(prefers-reduced-motion: reduce)").matches
const Scene = ({ className, label, box = "0 0 320 220", children }: { className?: string } & { label: string; box?: string; children: ReactNode }) => (
  <svg viewBox={box} role="img" aria-label={label} className={cn("illus", className)}>{children}</svg>
)

export const IllusAge = ({ className }: Props) => (
  <Scene className={className} label="A scale of years from birth, with a marker for today: the span between them is the patient's age" box="0 58 320 112">
    <path className="s-ink" d="M36.0 120H284.0"/>
    <path className="s-line" d="M85.6 127V134M135.2 127V134M184.8 127V134M234.4 127V134M284 127V134"/>
    <path className="s-hair s-mute" d="M60.8 127V131M110.4 127V131M160 127V131M209.6 127V131M259.2 127V131"/>
    <text x="36" y="154" textAnchor="middle">born</text>
    <text x="85.6" y="154" textAnchor="middle">20</text>
    <text x="135.2" y="154" textAnchor="middle">40</text>
    <text x="184.8" y="154" textAnchor="middle">60</text>
    <text x="234.4" y="154" textAnchor="middle">80</text>
    <text x="284" y="154" textAnchor="middle">100</text>
    <rect className="f-rose il-age-span" x="36.0" y="117" width="84.32" height="6"/>
    <circle className="f-ink" cx="36.0" cy="120" r="6"/>
    <g className="il-age-half"><text x="78.16" y="106" textAnchor="middle" className="t-rose">age</text>
    </g>
    <g className="il-age-now">
    <path className="s-line s-rose" d="M120.32 108V80"/>
    <circle className="f-rose s-bg" strokeWidth="3" cx="120.32" cy="120" r="8.5"/>
    <text x="120.32" y="72" textAnchor="middle" className="t-strong">today</text>
    </g>
  </Scene>
)

export const IllusSex = ({ className }: Props) => (
  <Scene className={className} label="The female symbol with an XX chromosome pair, and the male symbol with an XY pair">
    <rect className="s-line s-rose il-sex-pick" x="50" y="16" width="100" height="186" rx="16"/>
    <circle className="s-ink" cx="100" cy="54" r="20"/>
    <path className="s-ink" d="M100 74V104M87 90H113"/>
    <circle className="s-ink" cx="213" cy="62" r="20"/>
    <path className="s-ink" d="M227.14 47.86L247 28M232 28H247V43"/>
    <path className="s-ink" strokeWidth="6.5" d="M79.5 126L85 136L78 152M90.5 126L85 136L92 152M109.5 126L115 136L108 152M120.5 126L115 136L122 152"/>
    <path className="s-ink" strokeWidth="6.5" d="M201.0 126L206.5 136L199.5 152M212.0 126L206.5 136L213.5 152M232.5 135L236.5 142L240.5 135M236.5 142V152"/>
    <text x="100" y="184" textAnchor="middle" className="t-strong">Female</text>
    <text x="220" y="184" textAnchor="middle" className="t-strong">Male</text>
  </Scene>
)

export const IllusChestPain = ({ className }: Props) => (
  <Scene className={className} label="The upper body from the front, with the centre of the chest shaded where the pain is felt, spreading to the left arm and jaw">
    <defs>
    <radialGradient id="il-pain"><stop className="stop-rose" offset="0" stopOpacity="0.8"/>
    <stop className="stop-rose" offset="0.5" stopOpacity="0.42"/>
    <stop className="stop-rose" offset="1" stopOpacity="0"/>
    </radialGradient>
    <clipPath id="il-body"><path d="M149 58C149 66 148 72 142 76C132 82 112 82 100 90C88 98 84 110 83 124L79 222L241 222L237 124C236 110 232 98 220 90C208 82 188 82 178 76C172 72 171 66 171 58Z"/>
    <ellipse cx="160" cy="34" rx="21" ry="26"/>
    </clipPath>
    </defs>
    <path className="f-bg" d="M149 58C149 66 148 72 142 76C132 82 112 82 100 90C88 98 84 110 83 124L79 222L241 222L237 124C236 110 232 98 220 90C208 82 188 82 178 76C172 72 171 66 171 58Z"/>
    <g clipPath="url(#il-body)" className="il-pain">
    <ellipse fill="url(#il-pain)" cx="164" cy="130" rx="52" ry="42"/>
    <ellipse fill="url(#il-pain)" cx="210" cy="112" rx="30" ry="24" opacity="0.6"/>
    <ellipse fill="url(#il-pain)" cx="224" cy="156" rx="16" ry="62" opacity="0.85"/>
    <ellipse fill="url(#il-pain)" cx="160" cy="66" rx="20" ry="13" opacity="0.7"/>
    </g>
    <path className="s-ink" d="M149 58C149 66 148 72 142 76C132 82 112 82 100 90C88 98 84 110 83 124L79 222M171 58C171 66 172 72 178 76C188 82 208 82 220 90C232 98 236 110 237 124L241 222"/>
    <path className="s-line" d="M111 136C109 164 106 194 105 222M111 136C113 164 116 194 117 222M209 136C211 164 214 194 215 222M209 136C207 164 204 194 203 222"/>
    <path className="s-hair s-mute" d="M124 92C136 97 148 99 157 99M196 92C184 97 172 99 163 99"/>
    <ellipse className="s-ink f-bg" cx="160" cy="34" rx="21" ry="26"/>
  </Scene>
)

export const IllusDiabetes = ({ className }: Props) => (
  <Scene className={className} label="A blood vessel with red blood cells and a large number of sugar molecules flowing through it" box="0 30 320 170">
    <clipPath id="il-dm"><rect x="0" y="46" width="320" height="92"/>
    </clipPath>
    <rect className="f-rose-1" x="0" y="46" width="320" height="92"/>
    <g clipPath="url(#il-dm)"><g className="il-dm-flow" style={{ animationDelay: "-1.76s" }}><ellipse className="f-rose" cx="-24" cy="76" rx="11" ry="8.5"/>
    <ellipse className="f-bg" opacity="0.26" cx="-24" cy="76" rx="5.5" ry="3.6"/>
    </g>
    <g className="il-dm-flow" style={{ animationDelay: "-5.02s" }}><ellipse className="f-rose" cx="-24" cy="118" rx="11" ry="8.5"/>
    <ellipse className="f-bg" opacity="0.26" cx="-24" cy="118" rx="5.5" ry="3.6"/>
    </g>
    <g className="il-dm-flow" style={{ animationDelay: "-8.02s" }}><ellipse className="f-rose" cx="-24" cy="88" rx="11" ry="8.5"/>
    <ellipse className="f-bg" opacity="0.26" cx="-24" cy="88" rx="5.5" ry="3.6"/>
    </g>
    <g className="il-dm-flow" style={{ animationDelay: "-11.15s" }}><ellipse className="f-rose" cx="-24" cy="120" rx="11" ry="8.5"/>
    <ellipse className="f-bg" opacity="0.26" cx="-24" cy="120" rx="5.5" ry="3.6"/>
    </g>
    <g className="il-dm-flow" style={{ animationDelay: "-1.11s" }}><path className="f-bg s-line" d="M-17.5 116L-20.75 121.63L-27.25 121.63L-30.5 116L-27.25 110.37L-20.75 110.37Z"/>
    </g>
    <g className="il-dm-flow" style={{ animationDelay: "-2.8s" }}><path className="f-bg s-line" d="M-17.5 102L-20.75 107.63L-27.25 107.63L-30.5 102L-27.25 96.37L-20.75 96.37Z"/>
    </g>
    <g className="il-dm-flow" style={{ animationDelay: "-3.52s" }}><path className="f-bg s-line" d="M-17.5 62L-20.75 67.63L-27.25 67.63L-30.5 62L-27.25 56.37L-20.75 56.37Z"/>
    </g>
    <g className="il-dm-flow" style={{ animationDelay: "-4.43s" }}><path className="f-bg s-line" d="M-17.5 84L-20.75 89.63L-27.25 89.63L-30.5 84L-27.25 78.37L-20.75 78.37Z"/>
    </g>
    <g className="il-dm-flow" style={{ animationDelay: "-6s" }}><path className="f-bg s-line" d="M-17.5 66L-20.75 71.63L-27.25 71.63L-30.5 66L-27.25 60.37L-20.75 60.37Z"/>
    </g>
    <g className="il-dm-flow" style={{ animationDelay: "-6.52s" }}><path className="f-bg s-line" d="M-17.5 104L-20.75 109.63L-27.25 109.63L-30.5 104L-27.25 98.37L-20.75 98.37Z"/>
    </g>
    <g className="il-dm-flow" style={{ animationDelay: "-7.43s" }}><path className="f-bg s-line" d="M-17.5 126L-20.75 131.63L-27.25 131.63L-30.5 126L-27.25 120.37L-20.75 120.37Z"/>
    </g>
    <g className="il-dm-flow" style={{ animationDelay: "-9.2s" }}><path className="f-bg s-line" d="M-17.5 64L-20.75 69.63L-27.25 69.63L-30.5 64L-27.25 58.37L-20.75 58.37Z"/>
    </g>
    <g className="il-dm-flow" style={{ animationDelay: "-9.52s" }}><path className="f-bg s-line" d="M-17.5 110L-20.75 115.63L-27.25 115.63L-30.5 110L-27.25 104.37L-20.75 104.37Z"/>
    </g>
    <g className="il-dm-flow" style={{ animationDelay: "-10.57s" }}><path className="f-bg s-line" d="M-17.5 82L-20.75 87.63L-27.25 87.63L-30.5 82L-27.25 76.37L-20.75 76.37Z"/>
    </g>
    <g className="il-dm-flow" style={{ animationDelay: "-12.13s" }}><path className="f-bg s-line" d="M-17.5 68L-20.75 73.63L-27.25 73.63L-30.5 68L-27.25 62.37L-20.75 62.37Z"/>
    </g>
    <g className="il-dm-flow" style={{ animationDelay: "-12.2s" }}><path className="f-bg s-line" d="M-17.5 104L-20.75 109.63L-27.25 109.63L-30.5 104L-27.25 98.37L-20.75 98.37Z"/>
    </g>
    </g>
    <path className="s-ink" d="M0 46H320M0 138H320"/>
    <path className="f-bg s-line" d="M64.5 178L61.25 183.63L54.75 183.63L51.5 178L54.75 172.37L61.25 172.37Z"/>
    <text x="72" y="182" textAnchor="start">sugar (glucose)</text>
    <ellipse className="f-rose" cx="196" cy="178" rx="11" ry="8.5"/>
    <ellipse className="f-bg" opacity="0.26" cx="196" cy="178" rx="5.5" ry="3.6"/>
    <text x="214" y="182" textAnchor="start">red blood cell</text>
  </Scene>
)

export const IllusBP = ({ className }: Props) => (
  <Scene className={className} label="A blood pressure cuff with its bulb and gauge; the needle sits in the high part of the scale">
    <path className="s-ink" d="M110 114C110 166 228 180 228 138"/>
    <path className="s-ink" d="M44 114C44 146 54 168 70 180"/>
    <rect className="s-ink f-tint" x="16" y="46" width="118" height="68" rx="14"/>
    <rect className="s-hair s-mute" strokeDasharray="3 4" x="24" y="54" width="68" height="52" rx="8"/>
    <path className="s-line" d="M102 46V114"/>
    <path className="s-ink f-tint" d="M70 186C70 177 82 171 98 171C114 171 126 177 126 186C126 195 114 201 98 201C82 201 70 195 70 186Z"/>
    <rect className="s-ink f-bg" x="126" y="180" width="13" height="12" rx="3"/>
    <circle className="s-ink f-bg" cx="228" cy="84" r="54"/>
    <path className="s-rose" strokeWidth="3.5" strokeLinecap="butt" opacity="0.4" d="M220.24 35.01A49.6 49.6 0 0 1 263.07 119.07"/>
    <path className="s-line" d="M195.47 116.53L201.13 110.87M195.47 51.47L201.13 57.13M260.53 51.47L254.87 57.13M260.53 116.53L254.87 110.87"/>
    <path className="s-hair" d="M187.01 104.88L190.58 103.07M182.57 91.2L186.52 90.57M182.57 76.8L186.52 77.43M187.01 63.12L190.58 64.93M207.12 43.01L208.93 46.58M220.8 38.57L221.43 42.52M235.2 38.57L234.57 42.52M248.88 43.01L247.07 46.58M268.99 63.12L265.42 64.93M273.43 76.8L269.48 77.43M273.43 91.2L269.48 90.57M268.99 104.88L265.42 103.07"/>
    <text x="209.62" dy="3.4" y="102.38" textAnchor="middle" className="t-small">0</text>
    <text x="209.62" dy="3.4" y="65.62" textAnchor="middle" className="t-small">100</text>
    <text x="246.38" dy="3.4" y="65.62" textAnchor="middle" className="t-small">200</text>
    <text x="246.38" dy="3.4" y="102.38" textAnchor="middle" className="t-small">300</text>
    <text x="228" y="124" textAnchor="middle" className="t-small">mmHg</text>
    <path className="s-rose il-bp-needle" strokeWidth="3" d="M225.9 92.75L236.17 49.97"/>
    <circle className="f-ink" cx="228" cy="84" r="5"/>
  </Scene>
)

export const IllusCholesterol = ({ className }: Props) => (
  <Scene className={className} label="An artery cut lengthwise: a fatty deposit in its wall narrows the channel, and blood cells squeeze through in single file" box="0 26 320 176">
    <clipPath id="il-ch"><rect x="0" y="40" width="320" height="108"/>
    </clipPath>
    <rect className="f-tint" x="0" y="40" width="320" height="108"/>
    <rect className="f-rose-1" x="0" y="51" width="320" height="86"/>
    <g clipPath="url(#il-ch)"><g className="il-ch-cell" style={{ offsetPath: "path('M-24 78C70 78 120 88 176 88C232 88 262 76 344 74')", animationDelay: "0s" }}><ellipse className="f-rose" rx="11" ry="8.5"/>
    <ellipse className="f-bg" opacity="0.26" rx="5.5" ry="3.6"/>
    </g>
    <g className="il-ch-cell" style={{ offsetPath: "path('M-24 78C70 78 120 88 176 88C232 88 262 76 344 74')", animationDelay: "-5s" }}><ellipse className="f-rose" rx="11" ry="8.5"/>
    <ellipse className="f-bg" opacity="0.26" rx="5.5" ry="3.6"/>
    </g>
    <g className="il-ch-cell" style={{ offsetPath: "path('M-24 112C70 112 112 90 176 88C240 86 262 108 344 112')", animationDelay: "-2.5s" }}><ellipse className="f-rose" rx="11" ry="8.5"/>
    <ellipse className="f-bg" opacity="0.26" rx="5.5" ry="3.6"/>
    </g>
    <g className="il-ch-cell" style={{ offsetPath: "path('M-24 112C70 112 112 90 176 88C240 86 262 108 344 112')", animationDelay: "-7.5s" }}><ellipse className="f-rose" rx="11" ry="8.5"/>
    <ellipse className="f-bg" opacity="0.26" rx="5.5" ry="3.6"/>
    </g>
    </g>
    <path className="f-wall" d="M124 51C152 51 162 71 188 71C214 71 224 51 252 51Z"/>
    <path className="f-wall" d="M80 137C118 137 130 103 164 103C198 103 210 137 248 137Z"/>
    <path className="s-line" d="M0 51H124C152 51 162 71 188 71C214 71 224 51 252 51H320"/>
    <path className="s-line" d="M0 137H80C118 137 130 103 164 103C198 103 210 137 248 137H320"/>
    <circle className="s-hair f-bg" cx="150" cy="126" r="3.5"/>
    <circle className="s-hair f-bg" cx="165" cy="117" r="4.5"/>
    <circle className="s-hair f-bg" cx="181" cy="127" r="3"/>
    <circle className="s-hair f-bg" cx="188" cy="61" r="3"/>
    <path className="s-ink" d="M0 40H320M0 148H320"/>
    <path className="s-hair s-mute" d="M164 156V168"/>
    <text x="164" y="184" textAnchor="middle">fatty deposit</text>
  </Scene>
)

export const IllusSmoking = ({ className }: Props) => (
  <Scene className={className} label="A lit cigarette with a thin line of smoke rising from its tip">
    <defs><linearGradient id="il-smoke" gradientUnits="userSpaceOnUse" x1="0" y1="132" x2="0" y2="14">
    <stop className="stop-mute" offset="0" stopOpacity="0.85"/>
    <stop className="stop-mute" offset="0.6" stopOpacity="0.4"/>
    <stop className="stop-mute" offset="1" stopOpacity="0"/>
    </linearGradient>
    </defs>
    <g transform="translate(14 -4)">
    <path className="il-smoke-a" stroke="url(#il-smoke)" strokeWidth="3" d="M226 128C212 110 242 96 228 76C216 58 240 44 230 18"/>
    <path className="il-smoke-b" stroke="url(#il-smoke)" strokeWidth="2.25" d="M236 124C228 110 248 100 240 84C234 72 246 64 242 50"/>
    <g transform="rotate(-10 150 152)">
    <path className="f-bg" d="M55 141H204V163H55A3 3 0 0 1 52 160V144A3 3 0 0 1 55 141Z"/>
    <rect className="f-wall" x="52" y="141" width="52" height="22" rx="3"/>
    <path className="f-tint s-ink" d="M208 141H219A9 11 0 0 1 219 163H208Z"/>
    <path className="s-ink" d="M205 141H55A3 3 0 0 0 52 144V160A3 3 0 0 0 55 163H205"/>
    <path className="s-line" d="M104 141V163M111 141V163"/>
    <rect className="f-bg" x="203" y="139.25" width="8" height="25.5"/>
    <rect className="f-rose il-ember" x="203" y="139.25" width="8" height="25.5"/>
    </g>
    </g>
  </Scene>
)

export const IllusECG = ({ className }: Props) => (
  <Scene className={className} label="A strip of ECG paper with the heart's electrical tracing running across it" box="0 18 320 184">
    <clipPath id="il-ecg"><rect x="20" y="30" width="280" height="160" rx="9"/>
    </clipPath>
    <rect className="f-bg" x="20" y="30" width="280" height="160" rx="9"/>
    <g clipPath="url(#il-ecg)">
    <path className="s-rose" strokeWidth="0.6" opacity="0.28" strokeLinecap="butt" d="M28 30V190M36 30V190M44 30V190M52 30V190M68 30V190M76 30V190M84 30V190M92 30V190M108 30V190M116 30V190M124 30V190M132 30V190M148 30V190M156 30V190M164 30V190M172 30V190M188 30V190M196 30V190M204 30V190M212 30V190M228 30V190M236 30V190M244 30V190M252 30V190M268 30V190M276 30V190M284 30V190M292 30V190M20 38H300M20 46H300M20 54H300M20 62H300M20 78H300M20 86H300M20 94H300M20 102H300M20 118H300M20 126H300M20 134H300M20 142H300M20 158H300M20 166H300M20 174H300M20 182H300"/>
    <path className="s-rose" strokeWidth="1" opacity="0.5" strokeLinecap="butt" d="M60 30V190M100 30V190M140 30V190M180 30V190M220 30V190M260 30V190M300 30V190M20 70H300M20 110H300M20 150H300M20 190H300"/>
    <path className="s-line il-ecg-run" strokeWidth="2.5" d="M20 118h14c5 0 5 -9 8 -9s3 9 8 9h8l3 5l6 -60l6 68l4 -13h12c8 0 8 -15 12 -15s4 15 12 15h27h14c5 0 5 -9 8 -9s3 9 8 9h8l3 5l6 -60l6 68l4 -13h12c8 0 8 -15 12 -15s4 15 12 15h27h14c5 0 5 -9 8 -9s3 9 8 9h8l3 5l6 -60l6 68l4 -13h12c8 0 8 -15 12 -15s4 15 12 15h27h14c5 0 5 -9 8 -9s3 9 8 9h8l3 5l6 -60l6 68l4 -13h12c8 0 8 -15 12 -15s4 15 12 15h27h14c5 0 5 -9 8 -9s3 9 8 9h8l3 5l6 -60l6 68l4 -13h12c8 0 8 -15 12 -15s4 15 12 15h27"/>
    </g>
    <rect className="s-ink" x="20" y="30" width="280" height="160" rx="9"/>
  </Scene>
)

export const IllusWallMotion = ({ className }: Props) => (
  <Scene className={className} label="A heart ultrasound showing the main pumping chamber in cross-section: its wall thickens with each squeeze, except one region that stays thin and still">
    <clipPath id="il-wm"><path d="M124 122L144.23 172.07A54 54 0 1 1 177.47 129.52Z"/>
    </clipPath>
    <path className="f-tint" d="M124 16L20.99 187.43A200 200 0 0 0 227.01 187.43Z"/>
    <path className="s-line s-mute" strokeWidth="1.5" d="M124 16L20.99 187.43A200 200 0 0 0 227.01 187.43Z"/>
    <rect className="s-ink f-bg" x="111" y="3" width="26" height="15" rx="4.5"/>
    <circle className="f-bg" cx="124" cy="122" r="50"/>
    <path className="f-wall" d="M124 122L142.73 168.36A50 50 0 1 1 173.51 128.96Z"/>
    <path className="f-rose-3" d="M156.68 126.59L173.51 128.96A50 50 0 0 1 142.73 168.36L136.36 152.6A33 33 0 0 0 156.68 126.59Z"/>
    <path className="s-hair" d="M144.91 124.94L173.51 128.96M131.91 141.58L142.73 168.36M111 138.64L93.22 161.4M103.09 119.06L74.49 115.04M116.09 102.42L105.27 75.64M137 105.36L154.78 82.6"/>
    <path className="s-line" d="M144.91 124.94L156.68 126.59M131.91 141.58L136.36 152.6"/>
    <circle className="f-bg il-wm-squeeze" cx="124" cy="122" r="33"/>
    <g clipPath="url(#il-wm)"><circle className="s-line il-wm-squeeze" vectorEffect="non-scaling-stroke" cx="124" cy="122" r="33"/>
    </g>
    <path className="s-line" d="M156.68 126.59A33 33 0 0 1 136.36 152.6"/>
    <circle className="s-ink" cx="124" cy="122" r="50"/>
    <path className="s-hair s-mute" d="M166.55 155.25H218"/>
    <text x="223" y="159.25" textAnchor="start">abnormal region</text>
  </Scene>
)

export const IllusBloodTest = ({ className }: Props) => (
  <Scene className={className} label="A clock with eight overnight hours marked as time without food, then a blood sugar meter showing a reading in milligrams per decilitre">
    <circle className="s-ink f-bg" cx="80" cy="92" r="50"/>
    <path className="s-rose" strokeWidth="11" strokeLinecap="butt" opacity="0.3" d="M57.48 79A26 26 0 1 1 80 118"/>
    <path className="s-line" d="M80 49L80 56M101.5 54.76L99.5 58.23M117.24 70.5L113.77 72.5M123 92L116 92M117.24 113.5L113.77 111.5M101.5 129.24L99.5 125.77M80 135L80 128M58.5 129.24L60.5 125.77M42.76 113.5L46.23 111.5M37 92L44 92M42.76 70.5L46.23 72.5M58.5 54.76L60.5 58.23"/>
    <path className="s-ink il-fbs-hand" d="M80 92V68"/>
    <circle className="f-ink" cx="80" cy="92" r="4.5"/>
    <text x="80" y="166" textAnchor="middle">no food overnight</text>
    <path className="s-line s-mute" d="M146 92H172M165 85L172 92L165 99"/>
    <rect className="s-ink f-bg" x="229" y="142" width="22" height="40" rx="3"/>
    <rect className="f-rose il-fbs-drop" x="234" y="167" width="12" height="9" rx="2"/>
    <rect className="s-ink f-bg" x="190" y="20" width="100" height="128" rx="16"/>
    <rect className="s-hair f-tint" x="202" y="34" width="76" height="54" rx="7"/>
    <text x="240" y="69" textAnchor="middle" className="t-num">98</text>
    <text x="240" y="82" textAnchor="middle" className="t-small">mg/dL</text>
    <circle className="s-line" cx="240.0" cy="118" r="11"/>
  </Scene>
)

// ---------------------------------------------------------------------------------------------------------------
// Ejection fraction, drawn as a figure: a section through the left side of the heart beating through one cardiac
// cycle, and beside it the volume of blood in the left ventricle over time. Everything is computed from one small
// table of the ventricle's volume, so the chamber, the valves, the arrows and the trace always agree. It follows
// the percentage being entered: a weaker heart squeezes less, leaves more blood behind, and the sum changes.
// (It is animated with SVG's own <animate>, which can change a path's shape in every browser; CSS cannot yet.)
const BEAT = 2.6                    // seconds per heartbeat in the drawing
const FULL = 120                    // mL in a typical adult left ventricle when full
const DRAWN_AT = 58                 // the ejection fraction the squeezed outline below was drawn for
// volume over one beat (1 = full, 0 = fully squeezed), after the Wiggers diagram
const KNOTS = [[0, 1], [0.05, 1],   // both valves shut, pressure building
  [0.35, 0], [0.43, 0],             // blood pushed out, then both valves shut again
  [0.62, 0.72], [0.84, 0.8],        // fast filling, then slow filling
  [0.96, 1], [1, 1]]                // the atrium tops it up
const volumeAt = (phase: number) => {
  const ph = ((phase % 1) + 1) % 1
  for (let k = 0; k < KNOTS.length - 1; k++) {
    const [p0, v0] = KNOTS[k], [p1, v1] = KNOTS[k + 1]
    if (ph >= p0 && ph <= p1) {
      const u = p1 > p0 ? (ph - p0) / (p1 - p0) : 0
      return v0 + (v1 - v0) * u * u * (3 - 2 * u)
    }
  }
  return 1
}
const STEPS = 52
const PHASES = Array.from({ length: STEPS + 1 }, (_, k) => k / STEPS)
const num = (v: number) => String(Math.round(v * 100) / 100)

const VALVES = 98                   // the height of the two valves
const WALL = `M46 ${VALVES}C42 146 60 210 95 210C130 210 156 150 152 ${VALVES}`
const AORTA = `M62 ${VALVES}C57 88 60 80 60 66V-6H92V66C92 80 95 88 90 ${VALVES}`
const ATRIUM = `M100 ${VALVES}C101 76 110 52 130 52C149 52 160 64 158 82C157 90 154 95 150 ${VALVES}`
const CHAMBER_FULL = [62, VALVES, 60, 138, 72, 192, 95, 192, 118, 192, 138, 142, 136, VALVES]
const CHAMBER_SQUEEZED = [65, VALVES, 73, 126, 83, 176, 96, 176, 109, 176, 123, 128, 133, VALVES]
// the chamber's outline when it holds the fraction `v` of its stroke (1 = full), for a heart that squeezes `depth` as far
const chamber = (v: number, close: boolean, depth = 1) => {
  const c = CHAMBER_FULL.map((full, i) => num(full + (CHAMBER_SQUEEZED[i] - full) * depth * (1 - v)))
  return `M${c[0]} ${c[1]}C${c.slice(2, 8).join(" ")}C${c.slice(8).join(" ")}${close ? "Z" : ""}`
}
const GRAPH = 180, PEN = 250, BEAT_WIDTH = 70          // left edge of the graph, where the pen writes, one beat's width
const mlY = (ml: number) => 72 + (FULL - ml) * (78 / 70)         // the graph's scale: the same height per mL for every patient

const loop = { dur: `${BEAT}s`, repeatCount: "indefinite" } as const
const sampled = { ...loop, calcMode: "linear", keyTimes: PHASES.map(num).join(";") } as const
type Moments = [phase: number, value: number][]
const AORTIC_OPEN: Moments = [[0, 0], [0.05, 0], [0.09, 1], [0.32, 1], [0.36, 0], [1, 0]]     // only while blood is pushed out
const MITRAL_OPEN: Moments = [[0, 0], [0.43, 0], [0.48, 1], [0.95, 1], [1, 0]]                // only while the chamber refills
const OUT_ARROW: Moments = [[0, 0], [0.06, 0], [0.12, 1], [0.28, 1], [0.36, 0], [1, 0]]
const IN_ARROW: Moments = [[0, 0], [0.44, 0], [0.5, 1], [0.6, 1], [0.72, 0.3], [0.86, 0.3], [0.92, 1], [0.99, 0], [1, 0]]
const times = (m: Moments) => m.map(([p]) => p).join(";")

// one flap of a valve: a line hinged at (x, y) that swings by `swing` degrees when the valve opens
const Leaflet = ({ x, y, dx, dy, swing, open }: { x: number; y: number; dx: number; dy: number; swing: number; open: Moments }) => (
  <path className="s-line" strokeWidth="2.4" d={`M${x} ${y}l${dx} ${dy}`}>
    {motion && <animateTransform attributeName="transform" type="rotate" {...loop} keyTimes={times(open)}
      values={open.map(([, a]) => `${a * swing} ${x} ${y}`).join(";")} />}
  </path>
)
const Arrow = ({ d, show }: { d: string; show: Moments }) => (
  <path className="s-bg" strokeWidth="2.5" opacity="0" d={d}>
    {motion && <animate attributeName="opacity" {...loop} keyTimes={times(show)} values={show.map(([, v]) => v).join(";")} />}
  </path>
)

export const IllusPump = ({ value, ...p }: Props) => {
  const ef = Math.min(80, Math.max(10, typeof value === "number" ? value : 55))
  const left = Math.round(FULL * (1 - ef / 100)), out = FULL - left
  const f = useMemo(() => {
    const depth = ef / DRAWN_AT
    const y = (phase: number) => num(mlY(left + out * volumeAt(phase)))
    return {
      blood: PHASES.map((ph) => chamber(volumeAt(ph), true, depth)).join(";"),
      edge: PHASES.map((ph) => chamber(volumeAt(ph), false, depth)).join(";"),
      pen: PHASES.map(y).join(";"),
      trace: "M" + Array.from({ length: 2 * STEPS + 1 }, (_, k) => k - STEPS).map((k) => `${num(PEN + (BEAT_WIDTH * k) / STEPS)} ${y(k / STEPS)}`).join("L"),
    }
  }, [ef, left, out])
  const top = mlY(FULL), bottom = mlY(left)
  return (
    // keyed by the value: a new number restarts every moving part together, so they can never fall out of step
    <Scene key={ef} className={p.className} label={`A section through the left side of the heart. The left ventricle fills to ${FULL} millilitres, squeezes, and is left with ${left}. The ${out} it pushed out is ${ef} percent of what it held: the ejection fraction.`}>
      <clipPath id="il-pump-win"><rect x={GRAPH} y="58" width={PEN - GRAPH} height="150" /></clipPath>
      {/* muscle, then the blood in the aorta, the atrium and the ventricle */}
      <path className="f-rose-2" d={`${WALL}Z`} />
      <path className="f-blood" d={`${AORTA}Z`} /><path className="f-blood" d={`${ATRIUM}Z`} />
      <path className="f-blood" d={chamber(1, true)}>{motion && <animate attributeName="d" {...sampled} values={f.blood} />}</path>
      {/* the ventricle's outline when full (dashed) and as it is now */}
      <path className="s-hair" strokeDasharray="2.5 3.5" d={chamber(1, false)} />
      <path className="s-line" d={chamber(1, false)}>{motion && <animate attributeName="d" {...sampled} values={f.edge} />}</path>
      <path className="s-ink" d={`${WALL}M46 ${VALVES}H62M136 ${VALVES}H152M90 ${VALVES}H100`} />
      <path className="s-ink" strokeWidth="3" d={`M62 ${VALVES}C57 88 60 80 60 66V-6M90 ${VALVES}C95 88 92 80 92 66V-6`} />
      <path className="s-ink" strokeWidth="2.5" d={ATRIUM} />
      <Leaflet x={62} y={VALVES} dx={14} dy={4} swing={-92} open={AORTIC_OPEN} /><Leaflet x={90} y={VALVES} dx={-14} dy={4} swing={92} open={AORTIC_OPEN} />
      <Leaflet x={100} y={VALVES} dx={18} dy={5} swing={56} open={MITRAL_OPEN} /><Leaflet x={136} y={VALVES} dx={-18} dy={5} swing={-56} open={MITRAL_OPEN} />
      <Arrow d="M76 62V34M69 41L76 34L83 41" show={OUT_ARROW} /><Arrow d="M118 78V116M111 109L118 116L125 109" show={IN_ARROW} />
      <text x="50" y="44" textAnchor="end">aorta</text><text x="131" y="42" textAnchor="middle">left atrium</text>
      <text x="2" y="176" textAnchor="start">left</text><text x="2" y="189" textAnchor="start">ventricle</text>
      <path className="s-hair s-mute" d="M30 172L90 146" /><circle className="f-mute" cx="90" cy="146" r="2" />
      {/* the sum, and the volume trace it comes from */}
      <text x={GRAPH} y="20" textAnchor="start" className="t-strong">ejection fraction</text>
      <text x={GRAPH} y="36" textAnchor="start" className="t-rose">{`${out} ÷ ${FULL} mL = ${ef}%`}</text>
      <path className="s-hair s-mute" strokeDasharray="2.5 3.5" d={`M${GRAPH} ${top}H270M${GRAPH} ${num(bottom)}H270`} />
      <path className="s-hair s-mute" d={`M${GRAPH} ${top}V${num(bottom)}`} />
      <text x={GRAPH} y={top - 7} textAnchor="start">{`${FULL} mL when full`}</text>
      <text x={GRAPH} y={bottom + 17} textAnchor="start">{`${left} mL left`}</text>
      <g clipPath="url(#il-pump-win)">
        <path className="s-line" strokeWidth="2.25" d={f.trace}>
          {motion && <animateTransform attributeName="transform" type="translate" {...loop} from="0 0" to={`-${BEAT_WIDTH} 0`} />}
        </path>
      </g>
      <circle className="f-rose s-bg" strokeWidth="2" cx={PEN} cy={top} r="5.5">{motion && <animate attributeName="cy" {...sampled} values={f.pen} />}</circle>
      <path className="s-rose" strokeWidth="2" d={`M266 ${top + 3}V${num(bottom - 3)}M262 ${top + 8}L266 ${top + 3}L270 ${top + 8}M262 ${num(bottom - 8)}L266 ${num(bottom - 3)}L270 ${num(bottom - 8)}`} />
      <text x="275" y={(top + bottom) / 2 - 2} textAnchor="start" className="t-rose">{`${out} mL`}</text>
      <text x="275" y={(top + bottom) / 2 + 12} textAnchor="start" className="t-rose">out</text>
    </Scene>
  )
}
