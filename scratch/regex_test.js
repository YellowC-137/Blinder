const regex = /\b([a-zA-Z0-9_]*key)\s*(?:[:=]|\s+)\s*@?["']([A-Za-z0-9_\-\.]{20,})["']/gi;
const tests = [
  '#define MY_API_KEY @"lkasdjflkasjdflkjasdf123"',
  'NSString * const api_key = @"lkasdjflkasjdflkjasdf123";',
  'let my_key: String = "lkasdjflkasjdflkjasdf123"',
  '#define TARGET_URL @"https://google.com"'
];

for (const t of tests) {
  regex.lastIndex = 0;
  console.log(regex.exec(t));
}
