import fs from 'fs';
import path from 'path';
import { definePlatform } from '../definePlatform.js';

/**
 * findEnclosingRubyLiteral
 *
 * Locates the string literal containing [matchStart, matchEnd) on a single
 * Ruby source line. Recognizes ", ', and supports backslash escapes. Returns
 * { start, end, quoteChar } or null.
 */
function findEnclosingRubyLiteral(lineContent, matchStart, matchEnd) {
  let inString = false;
  let curChar = '';
  let curStart = -1;

  for (let i = 0; i < matchStart; i++) {
    const c = lineContent[i];
    if (c === '\\' && i + 1 < lineContent.length) { i++; continue; }
    if (!inString) {
      if (c === '"' || c === "'") {
        inString = true;
        curChar = c;
        curStart = i;
      }
    } else if (c === curChar) {
      inString = false;
      curChar = '';
      curStart = -1;
    }
  }

  if (!inString) return null;
  const openIdx = curStart;
  const openChar = curChar;

  for (let i = matchEnd; i < lineContent.length; i++) {
    const c = lineContent[i];
    if (c === '\\' && i + 1 < lineContent.length) { i++; continue; }
    if (c === openChar) {
      return { start: openIdx, end: i + 1, quoteChar: openChar };
    }
  }

  return null;
}

/**
 * isPartOfMultilineConcat
 *
 * Detects whether the line is part of a Ruby string concatenation chain
 * (line continuation `\` on prev line, or trailing `\` on current line, or
 * leading `+` / `<<` operator). In these contexts replacing a string literal
 * with a bare ENV[...] expression breaks parsing — we need an interpolated
 * string instead so the chain stays string-typed.
 */
function isPartOfMultilineConcat(lineContent, prevLine, nextLine) {
  if (prevLine && /\\\s*$/.test(prevLine)) return true;
  if (/\\\s*$/.test(lineContent)) return true;
  if (/^\s*[+]\s*['"]/.test(lineContent)) return true;
  if (/['"]\s*[+]\s*$/.test(lineContent)) return true;
  return false;
}

export default definePlatform({
  id: 'ruby',
  name: 'ruby',
  category: 'backend',

  detect: async (repoPath) => {
    return fs.existsSync(path.join(repoPath, 'Gemfile'));
  },

  commonExtensions: ['.rb'],

  applyAdvancedFix: async ({ lineContent, prevLine, nextLine, match, envVarName, ext, relPath }) => {
    if (ext !== '.rb') return { handled: false };

    // Ruby/Rails test trees (spec/, test/, features/, fixtures/, factories/)
    // contain intentional dummy passwords (`123456`, `mastodonadmin`) — auto-
    // rewriting them to ENV[...] breaks fixture-driven specs. Scan still
    // surfaces the finding (LOW severity via isTestKey); we just skip the
    // source rewrite for these paths.
    if (relPath && /(?:^|\/)(?:spec|test|features|fixtures|factories)(?:\/|$)/.test(relPath.replace(/\\/g, '/'))) {
      return { handled: true, lineContent, injectedText: '', replacedText: '' };
    }

    const matchIdx = lineContent.indexOf(match);
    if (matchIdx < 0) return { handled: false };

    const literal = findEnclosingRubyLiteral(lineContent, matchIdx, matchIdx + match.length);
    if (!literal) return { handled: false };

    // String concat chains require interpolated form to keep the result
    // string-typed; standalone literals can use bare ENV[...].
    const accessor = isPartOfMultilineConcat(lineContent, prevLine, nextLine)
      ? `"#{ENV['${envVarName}']}"`
      : `ENV["${envVarName}"]`;

    const replacedText = lineContent.substring(literal.start, literal.end);
    const newLine = lineContent.substring(0, literal.start) + accessor + lineContent.substring(literal.end);

    return {
      handled: true,
      lineContent: newLine,
      injectedText: accessor,
      replacedText
    };
  },

  getAutoFixReplacement: (match, envVarName, ext, options) => {
    return `ENV["${envVarName}"]`;
  }
});

export const __test = {
  findEnclosingRubyLiteral,
  isPartOfMultilineConcat
};
