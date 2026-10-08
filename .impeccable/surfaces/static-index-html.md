---
version: 1
slug: "static-index-html"
primary_target: "static/index.html"
related_targets: []
---

# Surface: Tria dashboard (static/index.html)

Mode: Operate. Audience: hackathon judges (demo video, laptop, dim room) and clinicians, equally. Task: load or edit a patient, read CAD and per-artery risk on the heart, understand why, judge how far to trust it. Must keep every existing feature and the visible disclaimer. Must not feel gamey or like grey EHR software.

## Direction contract

THESIS: Each patient is a live journal figure. Figure 1A is the heart, 1B a forest-style dot plot of CAD and artery probabilities on one shared axis, 1C the SHAP forest plot, Table 1 the editable patient characteristics, Table 2 the validation. Refuses the dark navy, cyan-accent card dashboard.

OWN-WORLD: Cool uncoated journal stock (#eff1ee) with a whiter figure ground, near-black ink, two grey inks, booktabs rules (heavy top and bottom, hairline middle), no boxed cards. One interaction accent, journal blue (#1d4f80). Only data carries colour: a green, ochre, red risk ramp anchored at the cut-off, and a realistic heart (maroon myocardium, cream epicardial fat in the grooves, pale great arteries, dark veins) whose risk-coloured coronaries run in fat strips so they read first. Mark: an anatomical heart in ink with the three coronaries in the risk colours. Public Sans throughout, tabular figures, panel letters inside headings.

STORY: The viewer sees in one glance which artery is at risk, reads the exact probabilities against the cut-off on one axis, reads why in the forest plot, edits Table 1 and watches the dots slide, and finds the AUCs that say how far to trust each number.

FIRST VIEWPORT: Masthead with the mark and wordmark only, one-line disclaimer (copy kept short by user request). Three columns at 1280px and up: Table 1 (patient selector and editable characteristics, 320px), Figure 1A (heart with leader-line labels, dynamic caption, colour-bar legend, view switches), results column (big CAD percentage, panel B dot plot, panel C SHAP). Table 1 becomes a slide-over drawer at every width below 1280px, including phones (55 inputs would bury the results in a single column); it opens from the masthead and from beside the CAD headline. Below 900px the page is one column: figure, then results.

FORM: Journal figure and table system, candidate 7 of 7, seed key 2e8c5289. Raises: tentative ink for artery numbers (from cassette j-card); one shared risk axis (deep dive); one cord, selecting an artery reconfigures every panel (drawcord cape); fixed cells, values change in place (split-flap); no boxes, hierarchy by type and rules (cracktro). Signature interaction: markers slide along the shared axis as values are edited; selecting an artery turns the camera, tints its territory and retargets B and C together.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
