import assert from "node:assert/strict";

import { parseWhatsAppExport } from "../src/lib/whatsapp-import";

const android = `25/10/2026, 9:02 pm - Prashant Soni: First message
25/10/2026, 9:03 pm - +977 9840123456: <Media omitted>
25/10/2026, 9:04 pm - Prashant Soni: A message
that continues on the next line
25/10/2026, 9:04 pm - Prashant Soni: A message
that continues on the next line`;

const parsedAndroid = parseWhatsAppExport(android, "test-group", "DMY");
assert.equal(parsedAndroid.messages.length, 4);
assert.equal(parsedAndroid.messages[0].senderLabel, "Prashant Soni");
assert.equal(parsedAndroid.messages[1].phone, "+9779840123456");
assert.equal(parsedAndroid.messages[1].kind, "image");
assert.notEqual(parsedAndroid.messages[2].externalId, parsedAndroid.messages[3].externalId);

const ios = `[10/25/26, 9:02:05 PM] Prashant Soni: First message
[10/25/26, 9:03:05 PM] Another Founder: A second message`;
const parsedIos = parseWhatsAppExport(ios, "test-group", "MDY");
assert.equal(parsedIos.messages.length, 2);
assert.equal(parsedIos.messages[0].sentAt.getFullYear(), 2026);
assert.equal(parsedIos.messages[0].sentAt.getMonth(), 9);
assert.equal(parsedIos.messages[0].sentAt.getDate(), 25);

const repeated = parseWhatsAppExport(android, "test-group", "DMY");
assert.deepEqual(repeated.messages.map((message) => message.externalId), parsedAndroid.messages.map((message) => message.externalId));

console.log("WhatsApp import parser checks passed.");
