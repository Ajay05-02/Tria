# What makes a website look AI-generated, and what Tria changed

Date: 7 October 2026. Sources: the anti-template rules in the design skills used for this project (taste-skill §4 and §9 "AI tells", redesign-skill "Design audit", impeccable's review checklist), checked against Tria's own code and screenshots.

## Part 1. The tells

AI site builders converge on the same safe defaults. Each one alone is harmless; together they make a page look generated rather than designed. These are the recurring ones.

### Typography
| Tell | Why it reads as AI |
|---|---|
| One headline word in the accent colour ("Understand your heart, **artery** by artery") | The single most recognisable generated-hero move: emphasis by colour instead of by meaning. |
| A display serif, especially **Fraunces** or Instrument Serif, often in italic | The two serifs language models reach for whenever a brief sounds "premium" or "warm". taste-skill bans both as defaults. |
| Giant headline broken over 3 to 4 lines, word by word | "Oversized H1 that screams"; it pushes everything else below the fold. |
| ALL-CAPS, widely tracked micro-labels above everything ("WHY YOU CAN TRUST IT", "WHERE", "DIAGNOSTIC") | Decorative eyebrows that add a second label to things that already have one. |
| Zero-padded step numbers ("01", "02") as giant decorations | Enumeration as ornament; the count is usually already shown elsewhere. |
| Em-dashes (—) and middle dots (·) as separators everywhere | The most frequent stylistic fingerprint in generated copy and metadata strips. |

### Colour and surface
| Tell | Why it reads as AI |
|---|---|
| Warm cream background with espresso text and one saturated accent | The default "premium" palette; every second generated landing page uses it. |
| Accent saturation above ~80% | Reads loud and synthetic next to neutrals. |
| Coloured glow shadows under buttons (`shadow-primary/25`) | "Neon glow" CTA, a classic template signature. |
| Blurred ambient colour blobs drifting behind the hero | Decoration with no meaning. |
| Glassmorphism (frosted, blurred header) | Applied by default, not for a reason. |

### Layout
| Tell | Why it reads as AI |
|---|---|
| Everything centred in one narrow column | Symmetric and vertical; wastes the width of a laptop screen and forces scrolling. |
| Three equal cards in a row ("1 in 5 / 17.9M / 80%") | taste-skill calls this the most generic AI layout. |
| The same call to action twice ("Begin…" and "Start the assessment") | Filler to make a page feel longer; it also splits attention. |
| Tagline strip under the CTA ("Free · Private · Takes 2 minutes") | A trust micro-strip; noise inside the hero. |
| The same information shown twice (percentages on the 3D heart and again on cards, the disclaimer in the page and in the footer, an accuracy link in the header and again as a button) | Repetition instead of hierarchy. |
| Pill-shaped everything (buttons, tabs, chips, badges all fully rounded) | Default component styling, never adjusted. |

### Motion
| Tell | Why it reads as AI |
|---|---|
| Infinite-loop animations everywhere (pulsing rings, rising dots, bouncing arrow in the button) | Motion that communicates nothing. Every animation should explain a change of state. |
| Fake "Analyzing…" waits added on purpose | Theatre that makes software look slower than it is. |

### Copy and content
| Tell | Why it reads as AI |
|---|---|
| Inspirational filler verbs ("empower", "elevate", "unleash", "seamless") | Marketing words with no information. |
| Generic, unsourced statistics ("1 in 5 adults…", "80% preventable") | Numbers that sound authoritative but are not the product's own. |
| Decorative labels on illustrations ("DIAGNOSTIC") | Text that labels nothing. |

## Part 2. Findings in Tria and what changed

| Where | Found | Change |
|---|---|---|
| Landing headline | Pink accent word "artery", Fraunces italic, 4-line 88 px headline | One sans-serif family (Geist) in one colour, 2 lines, sized to sit beside the heart |
| Landing layout | Centred single column, about 2.5 screens tall | Two columns at laptop width: message and one call to action on the left, a real render of the 3D heart on the right; fits one screen |
| Landing CTAs | "Begin 11-question assessment" and "Start the assessment" | One primary button. The study-patient picker stays as a secondary choice |
| Landing extras | Ambient blobs, rising dots, pulsing rings, bouncing arrow, ECG card | Removed. The hero shows the actual product (a heart rendered by the app) instead of decoration |
| Stats | Three equal cards plus a repeating paragraph | One plain line of evidence under the hero, no cards |
| Tagline | "Free · Nothing is stored · About 2 minutes" under the button | Removed (privacy is on the Privacy page) |
| Palette | Warm cream, 83% saturated rose, glow shadows | Neutral off-white with one rose accent at about 65% saturation; no glows |
| Header | Frosted glass blur | Solid background with a hairline |
| Labels | ALL-CAPS eyebrows (WHERE, WHY, OPTIONAL, CHANCE OF CAD, DIAGNOSTIC, WHY YOU CAN TRUST IT) | Removed; headings say it in sentence case |
| Question screens | Giant pink "01"…"11" (duplicating the "3/11" progress), dashed "DIAGNOSTIC" frame, narrow vertical column | Step numbers removed (the header progress stays), frame removed, two columns at laptop width (question and picture left, answers right) |
| Results | Artery cards repeating the heart's percentages; disclaimer repeated above the footer; "How accurate is it?" button repeating the header link; middle-dot separators | Cards removed (the heart labels are the single source, click them to focus), duplicates removed, separators rewritten as plain sentences; two columns at laptop width |
| "Analyzing" screen | Forced 1.6 s wait | Shown only while the server works (at least 0.6 s so it does not flicker) |
| Shapes | Fully rounded pills everywhere | Buttons and tabs use a 10 px radius; cards 16 px |
| Text | Em-dash in the ECG illustration ("ECG Readout — Resting") and an en-dash in a confidence interval | Replaced with plain text and a hyphen |
| Accuracy page | Four equal stat cards | One row of figures without card boxes |

### Kept on purpose
| Item | Why it stays |
|---|---|
| The animated question illustrations (from Kard, plus three new ones) | They are the part of Kard you asked to replicate, and each one explains its question. Their loops are slow and stop for people who turn on reduced motion. |
| Lucide icons | The icon set that ships with shadcn/ui; changing it would mix two icon families. |
| The disclaimer in the footer | Required by the hackathon; it now appears once per page. |
