// Standalone regex sanity checks — verify URL / IPv4 / port-style heuristics
// behave as expected on edge inputs the team has hit in the wild.

let passed = 0;
let failed = 0;

function assertEq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { passed++; console.log(`✅ ${label}`); }
  else { failed++; console.error(`❌ ${label}\n   expected: ${e}\n   actual:   ${a}`); }
}

console.log('🧪 Regex Sanity');

// URL: skip whitelist domains, capture full URL otherwise
const regexUrl = /(https?:\/\/(?!schemas\.android\.com|www\.w3\.org|apple\.com|developer\.apple)(?:[a-zA-Z0-9.-]+)(?::\d+)?(?:[^\s"'<>]*))/gi;

assertEq(
  '//let JoinUrl = "https://192.168.13.19:6443/m/app/join.php"'.match(regexUrl),
  ['https://192.168.13.19:6443/m/app/join.php'],
  'URL: capture LAN host with port + path'
);

assertEq(
  '//let URL_Svr_KT:String = "https://219.240.37.147:9200/lguplus/mobile/JSONService.do"'.match(regexUrl),
  ['https://219.240.37.147:9200/lguplus/mobile/JSONService.do'],
  'URL: capture public IP host + port + path'
);

assertEq(
  'see https://www.w3.org/ns#'.match(regexUrl),
  null,
  'URL: w3.org whitelist (no match)'
);

// IPv4 pattern — strict octets
const regexIp = /\b(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;

assertEq(
  'let icrpT:String = "211.32.131.182"'.match(regexIp),
  ['211.32.131.182'],
  'IPv4: capture valid IP'
);

assertEq(
  'version 256.0.0.1 maybe'.match(regexIp),
  null,
  'IPv4: reject 256.x (out of octet range)'
);

// Port-style assignment: matches `*port = "1234"` etc., not `point = "..."`
const regexPort = /\b[a-zA-Z0-9_]*(?:port|pt)\b\s*(?::\s*[a-zA-Z0-9_]+\s*)?=\s*["']?(\d{2,5})["']?/gi;

const cases = [
  ['let icrpPt:String = "10500"', '10500', 'Port: typed Swift assignment'],
  ['serverPort = 8080', '8080', 'Port: bare assignment'],
  ['var pt = "443"', '443', 'Port: short var name'],
  ['point = "123"', null, 'Port: NOT matching point (substring guard)']
];
for (const [input, expected, label] of cases) {
  regexPort.lastIndex = 0;
  const m = regexPort.exec(input);
  assertEq(m ? m[1] : null, expected, label);
}

console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
