
import fs from 'fs';
import path from 'path';
import { scanProject } from '../src/detectors/scanner.js';

async function test() {
    const testRepo = path.resolve('./scratch/test_repo');
    if (fs.existsSync(testRepo)) fs.rmSync(testRepo, { recursive: true, force: true });
    fs.mkdirSync(testRepo, { recursive: true });

    console.log('--- Blinder Protection Logic Test ---');

    // 1. Setup Test Files
    
    // Normal file
    fs.writeFileSync(path.join(testRepo, 'App.m'), `
        NSString *const SECRET_KEY = @"my_secret_vault";
        #define MACRO_SECRET @"macro_val"
    `);

    // File with Third-party Heuristic (Copyright header)
    fs.writeFileSync(path.join(testRepo, 'LibrarySDK.m'), `
        /**
         * Copyright (c) 2024 RSKSW Security.
         * All rights reserved.
         */
        #define SDK_INTERNAL_KEY @"rsksw_private_key"
    `);

    // Folder to be ignored via .blinderrc
    const ignoreDir = path.join(testRepo, 'ExternalLib');
    fs.mkdirSync(ignoreDir);
    fs.writeFileSync(path.join(ignoreDir, 'LibHeader.h'), `
        #define LIB_KEY @"donot_touch_this"
    `);

    // .blinderrc
    fs.writeFileSync(path.join(testRepo, '.blinderrc'), JSON.stringify({
        ignorePaths: ['ExternalLib/**']
    }));

    // 2. Run Scan
    console.log('Running scan on test_repo...');
    const results = await scanProject(testRepo, ['ios']);

    // 3. Verify Results
    
    const libSdkMatch = results.find(r => r.file === 'LibrarySDK.m');
    const externalLibMatch = results.find(r => r.file.includes('ExternalLib'));
    const normalAppMatches = results.filter(r => r.file === 'App.m');

    let allPassed = true;

    // Verify .blinderrc
    if (externalLibMatch) {
        console.error('❌ FAIL: ExternalLib should have been ignored by .blinderrc');
        allPassed = false;
    } else {
        console.log('✅ PASS: ExternalLib correctly ignored by .blinderrc');
    }

    // Verify Heuristic
    if (libSdkMatch) {
        console.error('❌ FAIL: LibrarySDK.m should have been ignored by Copyright header heuristic');
        allPassed = false;
    } else {
        console.log('✅ PASS: LibrarySDK.m correctly ignored by heuristic');
    }

    // Verify Obj-C Macro Mapping
    const macroMatch = normalAppMatches.find(r => r.patternName === 'Objective-C Macro String');
    if (macroMatch) {
        if (macroMatch.envVarName === 'MACRO_SECRET' && macroMatch.match === 'macro_val') {
            console.log('✅ PASS: Obj-C Macro correctly mapped (Name: MACRO_SECRET, Value: macro_val)');
        } else {
            console.error(`❌ FAIL: Obj-C Macro mapping incorrect. Name: ${macroMatch.envVarName}, Value: ${macroMatch.match}`);
            allPassed = false;
        }
    } else {
        console.error('❌ FAIL: Objective-C Macro String not found in App.m');
        allPassed = false;
    }

    // Cleanup
    fs.rmSync(testRepo, { recursive: true, force: true });

    if (allPassed) {
        console.log('\n🌟 ALL TESTS PASSED SUCCESSFULLY! 🌟');
    } else {
        process.exit(1);
    }
}

test().catch(err => {
    console.error(err);
    process.exit(1);
});
