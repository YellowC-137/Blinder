const regexUrl = /(https?:\/\/(?!schemas\.android\.com|www\.w3\.org|apple\.com|developer\.apple)(?:[a-zA-Z0-9.-]+)(?::\d+)?(?:[^\s"'<>]*))/gi;
const string1 = '//let JoinUrl = "https://192.168.13.19:6443/m/app/join.php"';
const string2 = '//let URL_Svr_KT:String = "https://219.240.37.147:9200/lguplus/mobile/JSONService.do"';

console.log("URL1:", string1.match(regexUrl));
console.log("URL2:", string2.match(regexUrl));

const regexIp = /\b(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;
const stringIp = 'let icrpT:String = "211.32.131.182"';
console.log("IP:", stringIp.match(regexIp));

const regexPort = /\b[a-zA-Z0-9_]*(?:port|pt)\b\s*(?::\s*[a-zA-Z0-9_]+\s*)?=\s*["']?(\d{2,5})["']?/gi;
const stringPort1 = 'let icrpPt:String = "10500"';
const stringPort2 = 'serverPort = 8080';
const stringPort3 = 'var pt = "443"';
const stringPort4 = 'point = "123"'; // Should NOT match

console.log("Port1:", regexPort.exec(stringPort1)); regexPort.lastIndex = 0;
console.log("Port2:", regexPort.exec(stringPort2)); regexPort.lastIndex = 0;
console.log("Port3:", regexPort.exec(stringPort3)); regexPort.lastIndex = 0;
console.log("Port4:", regexPort.exec(stringPort4)); regexPort.lastIndex = 0;
