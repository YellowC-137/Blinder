import { patterns } from '../src/detectors/patterns.js';

const content = 'let URL_Svr_LG = "https://lg.usimcert.com/lguplus/mobile/JSONService.do";';
const filePath = 'CommonApi.swift';

console.log('Testing content:', content);

for (const pattern of patterns) {
    pattern.regex.lastIndex = 0;
    let match;
    while ((match = pattern.regex.exec(content)) !== null) {
        console.log(`Pattern Matched: ${pattern.name}`);
        console.log('Full Match:', match[0]);
        let matchValue = match[0];
        for (let g = match.length - 1; g >= 1; g--) {
            if (match[g] !== undefined) {
                matchValue = match[g];
                break;
            }
        }
        console.log('Extracted Value:', matchValue);
        console.log('---');
    }
}
