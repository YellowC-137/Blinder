
import { patterns } from '../src/detectors/patterns.js';

const testCases = [
    {
        name: 'Objective-C Multi-line Config',
        content: `NSString *const SECRET_URL = @"https://example.com/api/v1/ \\
                                            very_long_path_that_spans_multiple_lines";`,
        patternName: 'Objective-C Config String'
    },
    {
        name: 'Objective-C Macro with Comment',
        content: `#define API_SECRET @"mysecret" // Important secret`,
        patternName: 'Objective-C Macro String'
    },
    {
        name: 'Objective-C Extern Config',
        content: `extern NSString *const EXT_SECRET = @"extern_val";`,
        patternName: 'Objective-C Config String'
    }
];

console.log('--- Objective-C Pattern Verification ---');

testCases.forEach(tc => {
    const pattern = patterns.find(p => p.name === tc.patternName);
    if (!pattern) {
        console.error(`Pattern not found: ${tc.patternName}`);
        return;
    }

    pattern.regex.lastIndex = 0;
    const match = pattern.regex.exec(tc.content);
    
    if (match) {
        console.log(`[PASS] ${tc.name}`);
        console.log(`      Found: ${match[1]} = ${match[2]}`);
    } else {
        console.error(`[FAIL] ${tc.name}`);
        console.error(`      Content: ${tc.content}`);
    }
});
