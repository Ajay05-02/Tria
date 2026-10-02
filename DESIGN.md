---
name: flowstate
description: A patient as a live journal figure; coronary risk painted onto a realistic 3D heart.
colors:
  paper: "#eff1ee"
  figure-ground: "#f9faf8"
  field: "#ffffff"
  ink: "#14171c"
  ink-2: "#444a54"
  ink-3: "#5f6670"
  rule: "#c9cdc6"
  rule-soft: "#dde0da"
  journal-blue: "#1d4f80"
  journal-blue-deep: "#163f67"
  journal-blue-soft: "#dce6ef"
  risk-low: "#2f9a68"
  risk-mid: "#e0a21a"
  risk-high: "#c8352b"
  high-ink: "#a32b22"
  high-bg: "#f6e2df"
  low-ink: "#22704b"
  low-bg: "#dfeee5"
  warn-ink: "#7a4b00"
  warn-bg: "#f7ecd2"
typography:
  display:
    fontFamily: "Public Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "3.25rem"
    fontWeight: 750
    lineHeight: 1
    letterSpacing: "-0.03em"
    fontFeature: "tnum"
  headline:
    fontFamily: "Public Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 780
    lineHeight: 1
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Public Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "-0.005em"
  data:
    fontFamily: "Public Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 750
    lineHeight: 1.5
    fontFeature: "tnum"
  body:
    fontFamily: "Public Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  label:
    fontFamily: "Public Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.3
  note:
    fontFamily: "Public Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  none: "0px"
  status: "2px"
  control: "4px"
spacing:
  2xs: "4px"
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.journal-blue}"
    textColor: "{colors.field}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "34px"
  button-primary-hover:
    backgroundColor: "{colors.journal-blue-deep}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.journal-blue}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "34px"
  button-quiet-hover:
    backgroundColor: "{colors.journal-blue-soft}"
  icon-button:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.control}"
    size: "34px"
  icon-button-hover:
    backgroundColor: "{colors.rule-soft}"
    textColor: "{colors.ink}"
  input-number:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "5px 9px"
    height: "34px"
  input-invalid:
    backgroundColor: "{colors.high-bg}"
    textColor: "{colors.ink}"
  status-high:
    backgroundColor: "{colors.high-bg}"
    textColor: "{colors.high-ink}"
    rounded: "{rounded.status}"
    padding: "2px 7px"
  status-low:
    backgroundColor: "{colors.low-bg}"
    textColor: "{colors.low-ink}"
    rounded: "{rounded.status}"
    padding: "2px 7px"
  dot-plot-row-selected:
    backgroundColor: "{colors.journal-blue-soft}"
    rounded: "{rounded.control}"
    padding: "6px"
  vessel-label:
    backgroundColor: "{colors.figure-ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "3px 9px 3px 7px"
  disclaimer:
    backgroundColor: "{colors.warn-bg}"
    textColor: "{colors.warn-ink}"
    padding: "7px 24px"
---

# Design System: flowstate

## Overview

**Creative North Star: "The Live Journal Figure"**

Each patient is laid out as a figure from a cardiology journal: Table 1 holds the editable patient characteristics, Figure 1A is the heart, panel B is a forest-style dot plot of CAD and artery probabilities on one shared axis, panel C is the SHAP forest plot, and Table 2 reports validation. The page reads like printed stock: cool uncoated paper, near-black ink, two grey inks, and booktabs rules. Hierarchy comes from type weight and rules, never from boxes.

Colour is reserved for data. The one interaction accent, journal blue, marks selection, focus and actions; everything else that is coloured is a measured probability on the green, ochre, red risk ramp or the realistic tissue of the heart. Values change in place inside fixed cells, so editing a patient makes markers slide along the axis rather than re-laying out the page. Density is high and deliberate: on a desktop the whole figure fits in one viewport.

The system explicitly rejects the dark navy, cyan-accent card dashboard, and the gamified or sci-fi medical look.

**Key Characteristics:**
- Paper and figure ground, ink and rules; no cards, no panels with backgrounds.
- One interaction accent (journal blue); colour otherwise means risk.
- One family, Public Sans, with tabular figures everywhere.
- Booktabs tables: heavy ink top and bottom, hairline middle.
- Controls slightly rounded (4px); everything else square.
- Realistic heart whose risk-coloured coronaries read first.

## Colors

A cool, near-neutral print palette with a single blue voice and a data-only risk ramp.

### Primary
- **Journal Blue** (journal-blue): primary buttons, the selected tab underline, selected dot-plot row and vessel label border, link buttons, focus outlines, caret, checkbox accent, and "state" in the lowercase flowstate wordmark. Deepens to Journal Blue Deep on hover; Journal Blue Soft is the selected-row wash, quiet-button hover and text selection.

### Data: risk ramp
- **Risk Low / Risk Mid / Risk High** (risk-low, risk-mid, risk-high): a three-stop ramp anchored so that each model's own cut-off sits exactly on Risk Mid, eased over a window of 30 points either side. A probability 30 or more points below the cut-off is full Risk Low and 30 or more above is full Risk High; green to ochre eases with t squared (green holds below the cut-off) and ochre to red with t to the 0.7 (red arrives quickly above it). The colour-bar legend uses the exact computed stops of that curve. The same three values are declared in the stylesheet and in the heart renderer, and they colour the coronary arteries, the vessel label swatches, panel B markers, the legend bar, and the SHAP bars (Risk High raises, Risk Low lowers).
- **High Ink on High Wash, Low Ink on Low Wash** (high-ink/high-bg, low-ink/low-bg): text-safe darker versions of the ramp ends for the status tag, out-of-range fields and errors.
- **Warning Ochre Ink on Warning Wash** (warn-ink/warn-bg): the disclaimer strip and the "Check these inputs" note only.

### Neutral
- **Journal Stock** (paper): page background, masthead, Table 1 drawer.
- **Figure Ground** (figure-ground): the heart figure's slightly whiter plate, and the vessel label fill.
- **Field White** (field): editable cells only.
- **Ink** (ink): body text, heavy rules, axis lines, cut-off ticks, marker outlines.
- **Grey Ink 2** (ink-2): secondary text, captions, table headers, icon buttons.
- **Grey Ink 3** (ink-3): units, notes, axis labels, footer.
- **Rule** (rule) and **Soft Rule** (rule-soft): column dividers, hairlines between table groups, control borders, hover washes.

### Named Rules
**The Only Data Carries Colour Rule.** Layout, chrome and type stay in paper, ink and rules. Green, ochre and red appear only when they encode a predicted probability or its direction.

**The Shared Ramp Rule.** The risk ramp has one definition used by both the page and the 3D heart: anchored at each model's cut-off, saturating 30 points either side, with the same easing. Change the stops, window or easing in the renderer and the legend gradient together, or not at all.

**The One Accent Rule.** Journal blue is the only interaction colour. It never encodes risk, and risk colours never mark selection.

## Typography

**Display Font:** Public Sans (with system-ui, Segoe UI, sans-serif)
**Body Font:** Public Sans
**Label/Mono Font:** none; figures use Public Sans tabular numerals.

**Character:** A single plain, institutional grotesque in weights 400 to 800. Weight, not size or family, builds hierarchy, as in a journal figure.

### Hierarchy
- **Display** (750, 52px, line-height 1, -0.03em): the overall CAD percentage only. One per screen.
- **Headline** (780, 22px, line-height 1, -0.025em): the wordmark; the plate letter "A" on the heart (800).
- **Title** (700, 15px): panel and table headings. A bolder panel label ("Table 1", "B", "C") sits inside the heading, never above it.
- **Data** (750, 18px, tabular): probabilities beside the dot plot. Tentative artery numbers drop to 500 in Grey Ink 2.
- **Body** (400, 15px, line-height 1.5): base text, tabular figures on.
- **Label** (600, 13px): buttons, tabs, field labels, table cells, captions (13px in Grey Ink 2).
- **Note** (400, 12px): units, notes, axis ticks, footer, in Grey Ink 3. Notes cap at 68ch, captions at 72ch.

### Named Rules
**The Tabular Figures Rule.** Every number is set in tabular figures so values changing in place never shift their neighbours.

**The Label Inside the Heading Rule.** Panel letters and table numbers are part of the heading line. No separate small label above a heading.

## Layout

One 100dvh frame from 900px up: masthead (2px ink bottom rule), one-line disclaimer strip, then the working area. At 1280px and up the working area is three columns: Table 1 (20rem), Figure 1A (fluid), results (25.5rem), divided by 1px rules. Between 900px and 1279px Table 1 becomes a slide-over drawer from the left (min(24rem, 92vw), 2px ink right edge, scrim), opened from the masthead and from beside the CAD headline, leaving figure and results side by side. Below 900px the page is one column (figure at 52svh, then results) and Table 1 stays a drawer. Below 480px the view-control button drops its text label.

Spacing works on a tight 4px-based rhythm (4, 6, 8, 12, 16, 20, 24px). Column gutters are 18 to 20px; the masthead and disclaimer use 24px. Side panels and results scroll internally with overscroll contained. On coarse pointers every control grows to 44px.

## Elevation & Depth

Flat by default. Depth comes from the paper/figure-ground step and from rules, not shadow. Shadow appears in only two functional places: the vessel labels, which float over a moving 3D scene and need lift to stay legible, and the slide-over drawer, which sits above the page.

### Shadow Vocabulary
- **Label lift** (`box-shadow: 0 1px 3px rgba(20, 23, 28, 0.12)`): vessel labels over the canvas. Labels for arteries behind the heart drop the shadow and take a dashed border.
- **Selection halo** (`box-shadow: 0 0 0 2px #dce6ef`): selected vessel label.
- **Drawer** (`box-shadow: 8px 0 32px rgba(20, 23, 28, 0.18)`): Table 1 as a slide-over below 1280px.

### Named Rules
**The Rules Not Boxes Rule.** Panels are separated by 1px rules and the frame by 2px ink rules. No card backgrounds, no bordered containers, no decorative shadow.

## Shapes

Square by default: panels, figure, tables, legend bar, warning strip and SHAP bars have no radius. Controls (buttons, icon buttons, inputs, selects, vessel labels, dot-plot rows) take a slight 4px radius; the status tag takes 2px. Dot-plot markers are the only circles (13px, 1.5px ink ring). Cut-off ticks are 2px ink lines. Icons are the Phosphor regular set, drawn at 1.1em in currentColor.

The brand mark is a faceted (low-poly) heart: the left half in Ink with a darker lower facet, the right half in Journal Blue with a lighter upper facet, separated by thin paper-coloured seams, and a Risk High marker with a paper ring where the facets meet (the panel B marker). It sits beside the wordmark at 40px. The favicon is the same mark on a rounded paper tile so it reads on dark browser tabs.

## Components

### Buttons
Quiet and editorial; blue is the action signal.
- **Shape:** slight rounding (4px), 34px tall, 13px semibold label with an optional leading icon.
- **Primary:** Journal Blue fill, white text; hover deepens; active nudges down 1px.
- **Quiet:** transparent with a Rule border and blue text; hover takes the soft blue wash and a blue border.
- **Icon button:** 34px square, transparent, Grey Ink 2; hover takes the Soft Rule wash.
- **Link button:** blue underlined text (1px, offset 3px), thickening to 2px on hover.
- **Focus:** 2px Journal Blue outline, 2px offset, on every interactive element.

### Inputs / Fields
- **Style:** Field White cell, 1px Rule border, 4px radius, 34px tall. Numbers right-aligned in tabular figures. Selects use a Phosphor caret in Grey Ink 2.
- **Hover:** border darkens to a mid grey.
- **Error:** out-of-range values turn the field border and label High Ink, with a High Wash fill when invalid.
- **Read-only:** transparent, Grey Ink 2 (derived values such as BMI).

### Tabs
Text tabs on a rule: 13px semibold Grey Ink 3; hover inks the text and greys the underline; selected is Journal Blue with a 2px blue underline.

### Status tag
Small 12px bold tag, 2px radius, High Ink on High Wash above the cut-off, Low Ink on Low Wash below.

### Booktabs table (signature)
2px ink rule at top and bottom, 1px ink rule under the header and above the footer row, no vertical rules, no zebra. First column left-aligned, numbers right-aligned; confidence intervals in 12px Grey Ink 3. Table 1's collapsible groups use the same frame with Rule hairlines between groups and a rotating caret.

### Shared-axis dot plot (signature)
CAD and each artery share one 0 to 100% axis. Each row: name with AUC beneath, a 1px track, a 2px ink cut-off tick at that model's threshold, a 13px risk-coloured marker with an ink ring, and the value at right. Rows are buttons: hover takes the Soft Rule wash, selected takes the soft blue wash and a blue border. Markers slide (320ms ease-out) as values change. Artery rows are tentative: lighter value weight and a smaller marker.

### Forest plot
A one-line summary note, then an axis header ("Lowers" and "Raises" over the bars, "Points" over the value column). Each factor is a fixed two-line cell: the name on one line (500, truncated with an ellipsis) and the patient's value beneath in 12px Grey Ink 3. SHAP contributions run as horizontal bars from a central 1px ink zero line: Risk High to the right, Risk Low to the left, points right-aligned in Grey Ink 2. Formulas and method notes belong in Table 2's note, not under the panels.

### Heart figure (signature)
A realistic heart on the figure ground: deep maroon myocardium with a restrained wet sheen and fine surface relief, darker atria, irregular cream epicardial fat deposits that follow the grooves and thin toward the apex, pale cream-pink great arteries and near-black violet veins. Great vessels are tapered tubes that end in a cut disc showing a dark lumen, as in an anatomical specimen. The LAD, LCX and RCA run in fat strips and are coloured by their own risk; their materials are excluded from tone mapping so the rendered hue matches the label swatch and the panel B marker. Selecting an artery dims the others, gently pulses it, tints the muscle it supplies, turns the camera, and retargets panels B and C. Leader-line vessel labels carry a risk swatch, bold name and percentage; anchors are nudged where a label would sit on a great vessel, and every label is held at least 12px inside the figure. A colour-bar legend with a 2px ink cut-off tick sits under the figure with Torso, Risk map and Heartbeat switches and a quiet Reset view button.

### Guide strip, plain words and print
- **First-visit guide:** one quiet strip under the disclaimer on the figure ground: a one-sentence purpose and three numbered steps (the sequence is the instruction, so numbers are earned). Dismissed with an icon button and remembered per browser.
- **Plain words:** a masthead checkbox that swaps clinical names for everyday ones everywhere at once (LAD "Front artery", LCX "Side artery", RCA "Right artery", CAD "Any heart artery"), including the 3D labels, panel B, panel C tabs, headline and status. Remembered per browser.
- **Factor rows are links into Table 1:** clicking a panel C row opens the input it comes from (engineered features jump to their source input), scrolls to it, focuses it and flashes the row in Journal Blue Soft.
- **Print:** a quiet button prints the patient as an A4 landscape figure: masthead, disclaimer, Figure 1A as one image with its artery labels drawn in, panels B and C, Table 2. Controls, drawer and guide are hidden.
- **Header link:** Method (the README's validation section) sits in Journal Blue at the right of the masthead.
- **New patient first:** the page opens on a new patient with typical starting values. The 303 study patients are a separate "Example patients from the study" group; for those, the line under the selector shows the angiography result and the held-out (cross-validated) prediction, until any value is edited.

### Motion
State transitions only: 160ms for colour and border changes, 180 to 200ms for carets and label fades, 260ms for the drawer, 320ms for markers sliding along the axis, all on a strong ease-out (cubic-bezier(0.22, 1, 0.36, 1)). The heart beats at the patient's pulse and the camera tweens to a selected artery. Reduced motion turns off the heartbeat, camera tweens, all transitions and the loading shimmer.

## Do's and Don'ts

### Do:
- **Do** separate regions with rules: 1px Rule between columns and panels, 2px Ink for the masthead, footer and booktabs frame.
- **Do** keep journal blue (#1d4f80) as the single interaction colour for selection, focus and actions.
- **Do** colour data only through the shared risk ramp, anchored at each model's cut-off and saturating 30 points either side, and keep the CSS legend stops and heart renderer values identical.
- **Do** set every number in tabular figures and update values in place.
- **Do** put panel letters and table numbers inside the heading line ("Table 1 Patient characteristics", "B Probability of 50% or more narrowing").
- **Do** write visible copy in sentence case, plain and specific, without em or en dashes.
- **Do** keep the educational-prototype disclaimer visible in the warning strip directly under the masthead.
- **Do** honour reduced motion by stopping the heartbeat, camera tweens and transitions.

### Don't:
- **Don't** use cards, filled panels or bordered boxes to group content.
- **Don't** use the dark navy, cyan-accent dashboard look or sci-fi glow effects.
- **Don't** use risk green, ochre or red for chrome, selection or decoration.
- **Don't** round panels, figures or tables; only controls take the 4px radius.
- **Don't** add a second typeface or a system display face.
- **Don't** place small uppercase eyebrow labels above headings.
- **Don't** use emoji as icons; use the Phosphor regular sprite.
- **Don't** let the 3D renderer tone-map the coronary materials, or the heart and the labels will disagree on colour.
