import { Encoder, Decoder, Stream, Profile } from "@garmin/fitsdk";
import * as fs from "node:fs";

const toSemi = (deg) => Math.round((deg * 2 ** 31) / 180);
const base = new Date("2026-10-21T09:00:00Z");

const enc = new Encoder();
enc.onMesg(Profile.MesgNum.FILE_ID, {
  manufacturer: "development",
  product: 1,
  timeCreated: base,
  type: "activity",
});
const points = [
  { lat: 37.4, lon: 140.38, hr: 120, dist: 0 },
  { lat: 37.4005, lon: 140.3805, hr: 135, dist: 70 },
  { lat: 37.401, lon: 140.381, hr: 150, dist: 140 },
];
points.forEach((p, i) => {
  enc.onMesg(Profile.MesgNum.RECORD, {
    timestamp: new Date(base.getTime() + i * 5000),
    positionLat: toSemi(p.lat),
    positionLong: toSemi(p.lon),
    heartRate: p.hr,
    distance: p.dist,
  });
});
const bytes = enc.close();
fs.writeFileSync("sample.fit", bytes);
console.log("written bytes:", bytes.length);

function read(buf, label) {
  const stream = Stream.fromBuffer(buf);
  console.log(`--- ${label} ---`);
  console.log("isFIT:", Decoder.isFIT(stream));
  const decoder = new Decoder(stream);
  console.log("checkIntegrity:", decoder.checkIntegrity());
  const { messages, errors } = decoder.read();
  console.log("errors:", errors.length, "recordMesgs:", messages.recordMesgs?.length);
  return messages;
}

const m = read(fs.readFileSync("sample.fit"), "valid file");
m.recordMesgs.forEach((r, i) => {
  const lat = (r.positionLat * 180) / 2 ** 31;
  const lon = (r.positionLong * 180) / 2 ** 31;
  console.log(i, r.timestamp.toISOString(), lat.toFixed(5), lon.toFixed(5), r.heartRate, r.distance);
});

const broken = Buffer.from(fs.readFileSync("sample.fit"));
broken[broken.length - 5] ^= 0xff;
read(broken, "corrupted file");

read(Buffer.from("this is not a fit file at all"), "random text");
