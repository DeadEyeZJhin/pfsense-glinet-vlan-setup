# Latency-First Network Build

An interactive, client-facing HTML presentation of a two-site fiber + wireless network.
Static page — no build step, no framework, no server required.

**Hosted copy:** https://claude.ai/code/artifact/db74a9c3-1351-4e2c-8bbc-2d5b6506ee96

One deck, two hardware tiers. The **Full set / Budget set** switch in the top bar swaps the
slide set in place — Full set (pfSense + TP-Link JetStream, 32 slides) or Budget set
(GL.iNet GL-AX1800, 28 slides). Each tier has its own assembly slide. The choice is remembered.

## Contents

| Section | Covers |
|---------|--------|
| Cover · Agenda · Where this applies | Offices, homes, remote/mountain sites, small ISP / piso Wi-Fi |
| Hardware &amp; price | Every device, its single job, its peso cost — one version per tier, so the full set never shows budget gear |
| Site 1 / Site 2 topologies | Live diagrams + IP addressing and port maps |
| **Scale** | 200+ devices, 70+ vendos, 150 on one ₱5,000 router, 8 km longest link |
| **How it goes together** | Two animated build-ups per tier. Animation 1: the wireless P2P stack. Animation 2: the same box indoors, re-labelled for Home / Office / Business |
| The pillars | UnCGNAT · VLAN 802.1Q · FQ-CoDel SQM · one clean WAN |
| CGNAT | With vs without, side by side |
| VLAN vs flat | Blast radius, rogue DHCP, STP |
| **Anti-loopback** | Reset routers, miscabled ports, surge-reset gear — what STP and VLANs actually stop |
| FQ-CoDel | Bufferbloat theory, 600 Mbps shaped to ~540 |
| **Live simulator** | Animated FIFO vs FQ-CoDel queueing, real queue math |
| Where the queue forms | ISP modem vs your router |
| **Dual WAN** | Why load balancing broke banking apps and games, and what to do instead |
| Typical setup · Head to head | The usual 4-layer NAT chain, default-gateway collisions, compared |
| **Cost · Which tier** | ₱5,000 vs ₱21,000 and when each is right |
| Impact · Security · Verify | Per-environment value, controls, how to test every claim |
| Roadmap · Glossary · Source diagram · Summary | Appendix and wrap-up |

## Controls

| Key | Action |
|-----|--------|
| `←` `→` `Space` `PgUp/PgDn` | Navigate slides |
| `Home` / `End` | First / last slide |
| `T` | Toggle light / dark theme (remembered) |
| `L` | Cycle traffic-flow animation: both → downlink → uplink → off (remembered) |
| `N` | Toggle speaker notes |
| `F` | Fullscreen presentation mode |
| `P` | Print — expands the active deck into a PDF handout |

Touch: swipe left/right. Mouse: the dot rail on the right jumps to any slide.
Deep links work: `index.html#13` opens slide 13.

### Traffic-flow animation

Every connector in every topology diagram is animated in both directions:

- **blue dashes travelling down** = downlink, ISP → client (video, downloads, page loads)
- **orange dashes travelling up** = uplink, client → ISP (game inputs, voice, uploads, TCP ACKs)

Press `L` to isolate one direction when explaining a path. Disabled automatically under
`prefers-reduced-motion` and in print output.

## Pricing used

Only the routing and switching tier is priced — that is what determines whether a site gets
UnCGNAT, VLANs and FQ-CoDel at all.

| Item | PHP |
|------|-----|
| PLDT Fibr Plan 1899 — 600 Mbps | ₱1,899 / month |
| **Budget set** — GL.iNet GL-AX1800 | ₱5,000 |
| **Full set** — pfSense ₱10,000 + TP-Link JetStream T1500G-10PS ₱11,000 | ₱21,000 |
| Piso Wi-Fi vendo + E314n antenna (coin-op sites only) | ₱10,000 |

Deliberately **not** priced: wireless P2P bridges (any AP/Station pair — the reference sites
use Ubiquiti LiteBeam AC Gen2, but the design does not depend on it), client-side routers and
access points, cabling, masts, PoE, UPS and labour.

## Structure

```
index.html          the deck (markup only)
questions.md        open questions for you to answer inline
deck.css            shared styling, themes, flow animation, deck sets, print rules
deck.js             diagram engine, navigation, deck switching, theme, starfield, simulator
assets/             ui icons, logo, and the original source diagram
assets/devices/     isometric device illustrations used inside the diagrams
assets/art/         larger artwork shown at feature size on slides
assets/flat/        front-elevation devices used by the assembly animation
build.py            bundles everything into single self-contained files
presentation.html   generated — one file, opens offline, nothing external
artifact.html       generated — body-only fragment for publishing as a hosted page
.nojekyll           tells GitHub Pages to skip Jekyll processing
```

Rebuild the single-file versions after any edit:

```bash
python build.py
```

Diagrams are generated at runtime from data arrays in `deck.js` — `siteA()`, `siteB()`,
`typical()`, `flat()`, `vlan()`, `cgnatOn/Off()`, `flowBad/Good()`, `pillars()`,
`dualWanLB/Fail/Pin()`, `loopBad/Good()`. Edit a node list to change a topology; nothing
else needs touching.
Flow animation is added automatically to every edge (pass `flow:false` to suppress it).
An edge marked `wifi:true` is drawn as a wireless hop: no cable, no arrowhead, just two
WiFi fans facing each other across the gap, pulsing in turn.

Device icons are matched to nodes automatically by title, via `ICON_RULES` in `deck.js` —
no per-node wiring. Set `icon:'name'` on a node to override, or `icon:false` to suppress.
Icons live in `assets/devices/` and are resolved through `assetURL()`, which returns the
plain path for the loose files and a data URI in the bundled build.

Slides carry `data-deck="full"` or `data-deck="budget"`; a slide with no attribute appears in
both tiers.

The assembly animations run off one engine in `deck.js`: `makeRack(host, spec)` takes a spec of
devices, wires, labels and a timed step list. `specP2P('pfsense'|'router')` builds the wireless
stack for either tier; `specIndoor(core, scenario)` builds the indoor one and pulls its endpoint
icons and wording from `SCENARIOS` — edit that object to change what Home, Office or Business
say.

## Deploying to GitHub Pages

```bash
git init
git add .
git commit -m "feat: network topology presentation"
git branch -M main
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

Then **Settings → Pages → Source: `main` / root**. `index.html` is the landing page.

The repo is **public**, so GitHub Pages works on the free tier. Nothing in it identifies a site,
a client or a device — no public IPs, MAC addresses, hostnames or DHCP lease tables. The
`.gitignore` keeps router config exports and the local `archive/` folder out. `presentation.html`
is committed too, as a single self-contained file you can e-mail or open offline.

> `.gitignore` excludes saved router config exports (client MACs and DHCP lease tables) and
> the local `archive/` folder of screenshots and source images. Neither belongs in a public
> repo, private or not.

## Notes on the numbers

Latency figures on the comparison slides are typical published results for FQ-CoDel on shaped
consumer links and are labelled as illustrative. The verify slide lists how to measure every
claim on a live site. The dual-WAN section describes symptoms observed on a real deployment.

Measured bufferbloat on both reference sites: **A+ off-peak**, **A / B+ during 6–10 pm peak**,
with no user-visible problems at either grade.
