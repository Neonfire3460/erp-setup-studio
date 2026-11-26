// Ready-written ERP descriptions for Turtle AV and Neat codes. They're written from the vendor pricelists and
// the ERP data (no specs added), in one style: product, what it does, key specs, colour or mount type.
// The AI descriptions step uses these first, and the AI writes the rest. People can still edit every one.
import { codeKey } from "./util";

const LIB: Record<string, string> = {
  // ---------- Turtle AV: Dante adapters ----------
  "TAV-D2LEN":
    "Turtle AV Dante 2-Channel Analog Line Input Adapter, line level to Dante, with gain controls, PoE powered, 90% recycled plastic housing",
  "TAV-D2LEN-V2":
    "Turtle AV Dante 2-Channel Analog Line Input Adapter V2, line level to Dante, gain controls, PoE pass-through",
  "TAV-D2LDE":
    "Turtle AV Dante 2-Channel Analog Line Output Adapter, Dante to line level, with gain controls, PoE powered, 90% recycled plastic housing",
  "TAV-D2XEN":
    "Turtle AV Dante 2-Channel XLR Input Adapter, analog XLR to Dante, with gain controls, PoE powered, 90% recycled plastic housing",
  "TAV-D2XDE":
    "Turtle AV Dante 2-Channel XLR Output Adapter, Dante to analog XLR, with gain controls, PoE powered, 90% recycled plastic housing",
  "TAV-D2USB":
    "Turtle AV Dante 2-Channel USB-C I/O Adapter, connects a laptop or PC to Dante as a USB audio device, PoE powered",
  "TAV-D2BEN":
    "Turtle AV Dante 2-Channel Bluetooth Input Adapter, streams phone or laptop audio into Dante, PoE powered",
  "TAV-D2BEN-PRO":
    "Turtle AV Dante Pro 2-Channel Bluetooth Input Adapter, streams phone or laptop audio into Dante, PoE powered",
  "TAV-D2LEN-PRO":
    "Turtle AV Dante Pro 2-Channel Analog Line Input Adapter, line level to Dante, with gain controls, PoE powered",
  "TAV-D2LDE-PRO":
    "Turtle AV Dante Pro 2-Channel Analog Line Output Adapter, Dante to line level, with gain controls, PoE powered",
  "TAV-D2USB-PRO":
    "Turtle AV Dante Pro 2-Channel USB-C I/O Adapter, connects a laptop or PC to Dante as a USB audio device, PoE powered",
  "TAV-JEF":
    "Turtle AV JEF Dante Mic Preamp, AES67, primary and secondary Dante, dual PoE, locking etherCON, 8-band PEQ, compressor, expander, HPF/LPF, aluminium housing",
  // ---------- Turtle AV: wall plates ----------
  "TAV-BTWPUS-WHITE":
    "Turtle AV Dante Bluetooth Wall Plate, Bluetooth audio into Dante, networked API control, US 1-gang Decora, White",
  "TAV-BTWPUS-BLACK":
    "Turtle AV Dante Bluetooth Wall Plate, Bluetooth audio into Dante, networked API control, US 1-gang Decora, Black",
  "TAV-BTWPEU-WHITE":
    "Turtle AV Dante Bluetooth Wall Plate, Bluetooth audio into Dante, networked API control, EU wall box, White",
  "TAV-BTWPEU-BLACK":
    "Turtle AV Dante Bluetooth Wall Plate, Bluetooth audio into Dante, networked API control, EU wall box, Black",
  "TAV-XLRWP-IN-US-W":
    "Turtle AV Dual XLR Input Dante Wall Plate, mic preamps, phantom power, built-in DSP, networked API, US 1-gang Decora, White",
  "TAV-XLRWP-IN-US-B":
    "Turtle AV Dual XLR Input Dante Wall Plate, mic preamps, phantom power, built-in DSP, networked API, US 1-gang Decora, Black",
  "TAV-XLRWP-OUT-US-W":
    "Turtle AV Dual XLR Output Dante Wall Plate, Dante to analog XLR, built-in DSP, networked API, US 1-gang Decora, White",
  "TAV-XLRWP-OUT-US-B":
    "Turtle AV Dual XLR Output Dante Wall Plate, Dante to analog XLR, built-in DSP, networked API, US 1-gang Decora, Black",
  "TAV-XLRWP-IN-EU-W":
    "Turtle AV Dual XLR Input Dante Wall Plate, mic preamps, phantom power, built-in DSP, networked API, EU wall box, White",
  "TAV-XLRWP-IN-EU-B":
    "Turtle AV Dual XLR Input Dante Wall Plate, mic preamps, phantom power, built-in DSP, networked API, EU wall box, Black",
  "TAV-XLRWP-OUT-EU-W":
    "Turtle AV Dual XLR Output Dante Wall Plate, Dante to analog XLR, built-in DSP, networked API, EU wall box, White",
  "TAV-XLRWP-OUT-EU-B":
    "Turtle AV Dual XLR Output Dante Wall Plate, Dante to analog XLR, built-in DSP, networked API, EU wall box, Black",
  // ---------- Turtle AV: decoder and amplifiers ----------
  "TAV-DOWNTOWN":
    "Turtle AV DOWNTOWN Multichannel Dolby Atmos and DTS:X to Dante Encoder, decodes surround sound from HDMI sources onto the Dante network",
  "TAV-DPA150D":
    "Turtle AV 150W Dante Power Amplifier, Class D, 2x Dante and 2x line in, 2x Dante and 2x line out, 2x 75W outputs, built-in DSP",
  "TAV-DPA30D":
    "Turtle AV 30W PoE+ Dante Power Amplifier, plenum rated, 2x Dante and 2x line in, 2x Dante and 2x line out, 2x 15W outputs, built-in DSP",
  // ---------- Turtle AV: Boardroom Buddy and USB extenders ----------
  "TAV-BBHDMI-TX":
    "Turtle AV Boardroom Buddy HDMI Transmitter, 4K60 4:4:4 video, USB 3.2 Gen 1 and 2.5Gbps data over one CAT cable",
  "TAV-BBHDMI-RX":
    "Turtle AV Boardroom Buddy HDMI Receiver, 4K60 4:4:4 video, USB 3.2 Gen 1 and 2.5Gbps data over one CAT cable",
  "TAV-BBUSBC-TX":
    "Turtle AV Boardroom Buddy USB-C Transmitter, 4K60 4:4:4 video, USB 3.2 Gen 1 and 2.5Gbps data over one CAT cable, 100W device charging",
  "TAV-BBUSBC-RX":
    "Turtle AV Boardroom Buddy USB-C Receiver, 4K60 4:4:4 video, USB 3.2 Gen 1 and 2.5Gbps data over one CAT cable",
  "TAV-BBHDMI-TX-PRO":
    "Turtle AV Boardroom Buddy PRO HDMI Transmitter, 4K60 4:4:4 video, USB 3.2 Gen 2 over one CAT cable",
  "TAV-USBEXTKIT1":
    "Turtle AV USB 3.2 Gen 1 Extender Kit, 5Gbps USB up to 100m over CAT, host and device units included",
  "TAV-USBEXTKIT2":
    "Turtle AV USB-C Extender Kit, 4K60 4:4:4 video and USB 2.0 over CAT, host and device units included",
  "TAV-USBEXTKIT1-PROMO":
    "Turtle AV USB 3.2 Gen 1 Extender Kit, promo 6-pack (buy 5, get 1 free), 5Gbps USB up to 100m over CAT, host and device units",
  "TAV-USBEXTKIT2-PROMO":
    "Turtle AV USB-C Extender Kit, promo 6-pack (buy 5, get 1 free), 4K60 4:4:4 video and USB 2.0 over CAT, host and device units",
  // ---------- Turtle AV: Chazy 4K (Dante AV-A) ----------
  "TAV-CHAZY4K-MV":
    "Turtle AV CHAZY 4K Multiviewer, Dante AV-A, combines four 4K streams into one custom layout, HDMI/DisplayPort out and Dante AV-A stream out",
  "TAV-CHAZY4K-MV2":
    "Turtle AV CHAZY 4K Multiviewer 2, Dante AV-A, 8 inputs into one custom layout, 4K60 4:4:4",
  "TAV-CHAZY4K-TX":
    "Turtle AV CHAZY 4K Transmitter, Dante AV-A encoder, HDMI 2.0 4K60 4:4:4 HDR, low latency AV over IP",
  "TAV-CHAZY4K-RX":
    "Turtle AV CHAZY 4K Receiver, Dante AV-A decoder, HDMI 2.0 4K60 4:4:4 HDR, low latency AV over IP",
  "TAV-CHAZYUSB-TX":
    "Turtle AV CHAZY 4K USB-C Transmitter, Dante AV-A encoder, USB-C or HDMI 2.0 input, 4K60 4:4:4 HDR, low latency AV over IP",
  "TAV-CHAZYWPUS-TX":
    "Turtle AV CHAZY 4K Wall Plate Transmitter, Dante AV-A encoder, HDMI 2.0 4K60 4:4:4 HDR, low latency, US wall box",
  "TAV-CHAZY-CTL":
    "Turtle AV CHAZY Control, central management box for the CHAZY 4K AV over IP series",
  "TAV-CHAZY-CTLPRO":
    "Turtle AV CHAZY Control Pro, advanced central management box for the CHAZY 4K AV over IP series",
  "TAV-CHAZYRACK1U":
    "Turtle AV CHAZY 1U Rack Enclosure, holds any mix of 2 CHAZY transmitters or receivers",
  "TAV-CHAZYRACK2U":
    "Turtle AV CHAZY 2U Rack Enclosure, holds any mix of 4 CHAZY transmitters or receivers",
  "TAV-CHAZYRACK6U":
    "Turtle AV CHAZY 6U Rack Enclosure, holds any mix of 10 CHAZY transmitters or receivers",
  // ---------- Turtle AV: Darwin (H.265) ----------
  "TAV-DARWINHD-TX": "Turtle AV DARWIN HD Transmitter, H.265 AV over IP, HDMI 1080p60 4:4:4",
  "TAV-DARWINHD-RX": "Turtle AV DARWIN HD Receiver, H.265 AV over IP, HDMI 1080p60 4:4:4",
  "TAV-DARWIN-CTL":
    "Turtle AV DARWIN Control, central management box for the DARWIN HD H.265 AV over IP series",
  "TAV-DARWIN4K-TX": "Turtle AV DARWIN 4K Transmitter, H.265 AV over IP, HDMI 4K",
  "TAV-DARWIN4K-RX": "Turtle AV DARWIN 4K Receiver, H.265 AV over IP, HDMI 4K",
  "TAV-DARWIN4K-TX2": "Turtle AV DARWIN 4K Transmitter Gen 2, H.265 AV over IP, HDMI 4K with USB",
  "TAV-DARWIN4K-RX2": "Turtle AV DARWIN 4K Receiver Gen 2, H.265 AV over IP, HDMI 4K with USB",
  "TAV-DARWIN4K-CTL":
    "Turtle AV DARWIN 4K Control, central management box for the DARWIN 4K H.265 AV over IP series",
  "TAV-DARWINRACK1U":
    "Turtle AV DARWIN 1U Rack Enclosure, holds any mix of 4 DARWIN transmitters or receivers",
  "TAV-DARWINRACK4U":
    "Turtle AV DARWIN 4U Rack Enclosure, holds any mix of 12 DARWIN transmitters or receivers",
  // ---------- Turtle AV: matrix, bridges ----------
  "TAV-MX44VW":
    "Turtle AV 4x4 Video Wall Matrix and Multiviewer, 4K60 4:4:4, 4x HDMI 2.0 in, seamless switching, preset layouts, multichannel audio, CEC",
  "TAV-MX88VW":
    "Turtle AV 8x8 Video Wall Matrix and Multiviewer, 4K60 4:4:4, 8x HDMI 2.0 in, seamless switching, preset layouts, multichannel audio, CEC",
  "TAV-DDB":
    "Turtle AV Dante Domain Bridge, sample rate conversion, AES67, primary and secondary Dante networks, dual PoE",
  "TAV-MINEOLAMICRO":
    "Turtle AV Mineola MICro, dual XLR input to Dante, mic preamps, phantom power, built-in DSP, networked API",
  "TAV-MINEOLA2XLR":
    "Turtle AV Mineola 2x2 Dante Audio Bridge, 2x XLR in with 48V phantom, 2x XLR out, locking etherCON",
  "TAV-MINEOLA4XLR":
    "Turtle AV Mineola 4x4 Dante Audio Bridge, 4x XLR in with 48V phantom, 4x XLR out, locking etherCON",
  "TAV-MINEOLA8XLR":
    "Turtle AV Mineola 8x8 Dante Audio Bridge, 8x XLR in with 48V phantom, 8x XLR out, locking etherCON",
  "TAV-MINEOLA16XLR":
    "Turtle AV Mineola 16x16 Dante Audio Bridge, 16x XLR in with 48V phantom, 16x XLR out, locking etherCON",
  "TAV-MINEOLA32XLR": "Turtle AV Mineola 32x32 Dante Audio Bridge, 32x XLR in, 32x XLR out",
  "TAV-PHOENIX8":
    "Turtle AV Phoenix 8x8 Dante Audio Bridge, 8x in with 48V phantom, 8x out, all on Euroblock connectors",

  // ---------- Neat: room devices ----------
  "NEATBAR-BYOD":
    "Neat Bar BYOD, all-in-one video bar for Zoom and BYOD, rooms up to 10 people (5m), 12MP camera, 120° FOV, 8x digital zoom, auto-framing, 5 mics, mounts included",
  "NEATBAR2-BE":
    "Neat Bar 2 BYOD, all-in-one video bar for bring-your-own-device meetings, no Neat Pad required",
  "NEATBAR3-SE":
    "Neat Bar 3, all-in-one video bar for Zoom and Microsoft Teams, 4K camera, 16x zoom, auto-framing, requires Neat Pad",
  "NEATBOARD32-SE":
    'Neat Board 32, 32" all-in-one touch screen video device, 4K camera, 140° FOV, table stand included (adaptive stand and clamp sold separately)',
  "NEATBOARD50-SE":
    'Neat Board 50, 50" all-in-one touch screen video device for Zoom, Teams, BYOD and App Hub, optional adaptive floor stand or wall mount',
  "NEATBOARDPRO-SE":
    'Neat Board Pro, 65" all-in-one touch screen video device for Zoom, Teams, BYOD and App Hub, optional adaptive stand or wall mount',
  "NEATBOARD75-SE":
    'Neat Board 75, 75" all-in-one touch screen video device for Zoom and Microsoft Teams',
  "NEATCENTER-SE":
    "Neat Center, 360° companion camera and mic for Neat room devices, 3x 8MP cameras, mounting hardware included, requires a main Neat device",
  "NEATPADPRO10-SE":
    'Neat Pad Pro 10", touch screen room controller or scheduling display for Zoom, Teams and App Hub',
  "NEATPAD3-SE": "Neat Pad 3, touch screen room controller and scheduling display",
  "NEATBOARD32-NYU-BUNDLE":
    'Neat Board 32 bundle, 32" all-in-one touch screen video device with table stand',
  "NEATBARPRO-NYU-BUNDLE":
    "Neat Bar Pro bundle, Neat Bar Pro and Neat Pad with 5 years of Neat Pulse cover for both devices",
  "NEATPAD-NYU":
    "Neat Pad scheduling display bundle, with glass wall mounts and 5 years of warranty through Neat Pulse",
  // ---------- Neat: mounts and stands ----------
  "NEATBAR-MOUNT": "Neat Bar mount adapter",
  "NEATBAR2-MOUNT": "Neat Bar 2 mount adapter",
  "NEATBAR-SCREENMOUNTKIT": "Neat Bar screen mount kit, mounts Neat Bar on or under a display",
  "NEATBAR3-SCREENMOUNTKIT": "Neat Bar 3 screen mount kit, VESA",
  "NEATBAR3-WALLMOUNT": "Neat Bar 3 wall mount",
  "NEATBAR-STAND": "Neat Bar table stand",
  "NEATBAR-VESA-BAR": "Neat Bar VESA screen mount, horizontal bar",
  "NEATBAR-VESA-HEAD": "Neat Bar VESA screen mount, vertical bar",
  "NEATBAR-WALLBRACK": "Neat Bar wall mount bracket",
  "NEATBOARD-WALLMOUNT": "Neat Board wall mount",
  "NEATBOARD-STYLUS": "Neat Board stylus, pack of 2",
  "NEATBOARD50-ADAPTIVEMOUNT": "Neat Board 50 adaptive wall mount, height adjustable",
  "NEATBOARD50-ADAPTIVESTAND": "Neat Board 50 adaptive floor stand, mobile, with acoustic design",
  "NEATBOARD50-WALLMOUNT": "Neat Board 50 wall mount",
  "NEATBOARDPRO-ADAPTIVE-MOUNT":
    "Neat Board Pro adaptive wall mount, sits close to the wall, easy vertical height adjustment",
  "NEATBOARDPRO-ADAPTIVE-STAND":
    "Neat Board Pro adaptive floor stand, mobile, adjustable screen height",
  "NEATBOARDPRO-WALLMOUNT": "Neat Board Pro wall mount, VESA compatible",
  "NEATBOARDPRO-WALLMOUNT-NYU": "Neat Board Pro wall mount, VESA compatible",
  "BOARDPRO-ADAPT": "Neat Board Pro adapter for the Neat Board floor stand (NEATBOARD-FLOORSTAND)",
  "NEATCENTER-MOUNT-KIT": "Neat Center mounting kit, for ceiling or table mounting",
  "NB32-AD-TBL-BLT":
    "Neat Board 32 adaptive stand bolt-down kit, fixes the table stand or clamp to a table for permanent installs",
  "NB32-AD-TBLCL": "Neat Board 32 adaptive table clamp, fixes to the edge of a table",
  "NB32-AD-TBLCL-B": "Neat Board 32 adaptive mounting base kit, for the table clamp",
  "NB32-AD-TBLST": "Neat Board 32 adaptive table stand, height, tilt and swivel adjustment",
  "NB32-AD-TBLST-B": "Neat Board 32 adaptive table stand base kit",
  "NB32-CBL-LOCK": "Neat Board 32 cable lock cover, secures and hides the cables at the back",
  "NB32-PRIV": "Neat Board 32 camera privacy cover, magnetic",
  "NB32-TBLST": "Neat Board 32 fixed table stand",
  "NB32-WALL-MNT": "Neat Board 32 slim wall mount, fixed, minimal wall gap",
  "NP2-GLASS-MNT-K": "Neat Pad 2 glass mount kit, for glass walls",
  "NP2-SIDE-MNT-K": "Neat Pad 2 side mount kit, for a door frame or mullion",
  "NP2-WALL-MNT-K": "Neat Pad 2 wall mount kit",
  "NPP-GLASS-MNT":
    "Neat Pad Pro glass mount, for glass walls, uses the multi-bracket included with Neat Pad Pro",
  "NPP-SIDE-MNT":
    "Neat Pad Pro side mount, for a door frame or mullion, uses the multi-bracket included with Neat Pad Pro",
  "NEATPAD-SIDEMOUNT": "Neat Pad side mount",
  // ---------- Neat: cables and power ----------
  "NEAT-USBC-5M": "Neat USB-C cable, 5m, for video conferencing devices (NF-H3)",
  "NEATBAR-XX-PWR": "Neat Bar power cable, non-grounded, 3m (AU, EU, IN, JP, UK or US plug)",
  "BOARD-FRAME-UK-PWR": "Neat Board and Neat Frame power cable, grounded, 3m, UK plug",
  "FLOORSTAND-UK-PWR": "Neat floor stand power cable, grounded, 4.5m, UK plug",
  "NEATPAD-8P": "Neat Pad PoE power supply",
  "POE-INJ-XX":
    "Neat Center PoE injector, for networks that don't supply PoE (INT or CN plug, US uses INT)",
  // ---------- Neat: subscriptions and agreements ----------
  "BAR-BYOD-SEL1": "Neat Bar BYOD subscription, 1 year",
  "BAR-BYOD-SEL3": "Neat Bar BYOD subscription, 3 years",
  "NEAT-EA-PRO-PU":
    "Neat Enterprise Agreement Pro, 3 years per front-of-room device, warranty, support and licensing, paid up front, signed EA with end customer required",
  "PULSE-PROTECT-BOARD75-3":
    "Neat Pulse Protect for Neat Board 75, Care (support) and Cover (advance replacement), 3 years",
};

const DEVICES: [RegExp, string][] = [
  [/^BAR2-PAD10-/, 'Neat Bar 2 and Neat Pad Pro 10"'],
  [/^BAR2-PAD2-/, "Neat Bar 2 and Neat Pad 2"],
  [/^BARPRO-PAD10-/, 'Neat Bar Pro and Neat Pad Pro 10"'],
  [/^BARPRO-PAD2-/, "Neat Bar Pro and Neat Pad 2"],
  [/^BAR2B-PLUS/, "Neat Bar 2 BYOD"],
  [/^BAR-BYOD/, "Neat Bar BYOD"],
  [/^BAR3-/, "Neat Bar 3 and Neat Pad"],
  [/^BAR2-/, "Neat Bar 2 and Neat Pad"],
  [/^BARPRO/, "Neat Bar Pro and Neat Pad"],
  [/^BAR/, "Neat Bar and Neat Pad"],
  [/^BOARD32-/, "Neat Board 32"],
  [/^BOARD50-/, "Neat Board 50"],
  [/^BOARDPRO-/, "Neat Board Pro"],
  [/^BOARD/, "Neat Board"],
  [/^CENTER/, "Neat Center"],
  [/^FRAME/, "Neat Frame"],
  [/^PAD2-/, "Neat Pad 2"],
  [/^PAD/, "Neat Pad"],
];

/** PULSE-PLUS-<device><years>: one clear pattern for every Neat Pulse Plus code. */
function pulsePlus(code: string): string | null {
  const m = /^PULSE-PLUS-(.+?)-?(\d)$/i.exec(code.trim());
  if (!m) return null;
  const rest = m[1]!.toUpperCase().replace(/-?PLUS$/, "-PLUS") + "-";
  const years = Number(m[2]);
  // "PAD2" alone is Neat Pad for 2 years; "PAD2-1" is Neat Pad 2 for 1 year.
  const dev = DEVICES.find(([re]) => re.test(rest.replace(/^PAD-$/, "PAD")))?.[1];
  if (!dev || years < 1 || years > 5) return null;
  return `Neat Pulse Plus for ${dev}, Control (management and monitoring) and Care (support), ${years} year${years === 1 ? "" : "s"}`;
}

/** A ready-written description for this code, or null when the AI should write one. */
export function libraryDescription(itemCode: string): string | null {
  const k = codeKey(itemCode);
  for (const [code, d] of Object.entries(LIB)) if (codeKey(code) === k) return d;
  return pulsePlus(itemCode);
}
