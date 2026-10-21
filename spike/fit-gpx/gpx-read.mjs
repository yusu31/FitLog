import { XMLParser, XMLValidator } from "fast-xml-parser";

const pt = (lat, lon, ele, time) =>
  `<trkpt lat="${lat}" lon="${lon}"><ele>${ele}</ele><time>${time}</time></trkpt>`;
const wrap = (inner) =>
  `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="spike" xmlns="http://www.topografix.com/GPX/1/1">${inner}</gpx>`;

const cases = {
  normal: wrap(
    `<trk><trkseg>${pt(37.4, 140.38, 240, "2026-10-21T09:00:00Z")}${pt(37.4005, 140.3805, 241, "2026-10-21T09:00:05Z")}${pt(37.401, 140.381, 243, "2026-10-21T09:00:10Z")}</trkseg></trk>`,
  ),
  onePoint: wrap(`<trk><trkseg>${pt(37.4, 140.38, 240, "2026-10-21T09:00:00Z")}</trkseg></trk>`),
  twoSegments: wrap(
    `<trk><trkseg>${pt(37.4, 140.38, 240, "2026-10-21T09:00:00Z")}${pt(37.4005, 140.3805, 241, "2026-10-21T09:00:05Z")}</trkseg><trkseg>${pt(37.402, 140.382, 245, "2026-10-21T09:10:00Z")}${pt(37.4025, 140.3825, 246, "2026-10-21T09:10:05Z")}</trkseg></trk>`,
  ),
  noTrack: wrap(`<metadata><name>empty</name></metadata>`),
  brokenXml: `<gpx><trk><trkseg><trkpt lat="37.4" lon="140.38">`,
};

const asArray = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

function naive(xml) {
  const p = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const g = p.parse(xml).gpx;
  return g?.trk?.trkseg?.trkpt;
}

function robust(xml) {
  const valid = XMLValidator.validate(xml);
  if (valid !== true) return { error: valid.err.msg };
  const p = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const g = p.parse(xml).gpx;
  const segs = asArray(g?.trk).flatMap((t) => asArray(t.trkseg));
  const points = segs.map((s) => asArray(s.trkpt).map((q) => ({
    lat: Number(q["@_lat"]), lon: Number(q["@_lon"]), ele: Number(q.ele), time: q.time,
  })));
  return { segments: points.length, points: points.flat().length, first: points.flat()[0] };
}

for (const [name, xml] of Object.entries(cases)) {
  const n = naive(xml);
  const nDesc = n === undefined ? "undefined" : Array.isArray(n) ? `array(${n.length})` : "NOT an array (object)";
  console.log(`[${name}] naive trkpt: ${nDesc}`);
  console.log(`[${name}] robust:`, JSON.stringify(robust(xml)));
}
