const axios = require("axios");
const fs = require("fs");
const path = require("path");

const QuantixProxies = [];
const QuantixFolder = "api";
const QuantixOutputFile = path.join(QuantixFolder, "proxy.txt");

// Pastikan folder "api" ada
if (!fs.existsSync(QuantixFolder)) {
  fs.mkdirSync(QuantixFolder, { recursive: true });
}

// Hapus file proxy.txt jika sudah ada
if (fs.existsSync(QuantixOutputFile)) {
  fs.unlinkSync(QuantixOutputFile);
  console.log("\x1b[33m%s\x1b[0m", `"${QuantixOutputFile}" telah dihapus.`); // Warna kuning
}

const QuantixProxySites = [
  "https://www.proxyscrape.com/api?request=getproxies&proxytype=http",
  "https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=1000&country=all",
  "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt",
  "https://www.proxy-list.download/api/v1/get?type=http",
  "https://raw.githubusercontent.com/roosterkid/openproxylist/main/HTTPS_RAW.txt",
  "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt",
  "https://raw.githubusercontent.com/MuRongPIG/Proxy-Master/main/http.txt",
  "https://raw.githubusercontent.com/officialputuid/KangProxy/KangProxy/http/http.txt",
  "https://raw.githubusercontent.com/prxchk/proxy-list/main/http.txt",
  "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt",
  "https://raw.githubusercontent.com/proxylist-to/proxy-list/main/http.txt",
  "https://raw.githubusercontent.com/yuceltoluyag/GoodProxy/main/raw.txt",
  "https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt",
  "https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/https.txt",
  "https://raw.githubusercontent.com/mmpx12/proxy-list/master/https.txt",
  "https://raw.githubusercontent.com/Anonym0usWork1221/Free-Proxies/main/proxy_files/http_proxies.txt",
  "https://raw.githubusercontent.com/opsxcq/proxy-list/master/list.txt",
  "https://raw.githubusercontent.com/Anonym0usWork1221/Free-Proxies/main/proxy_files/https_proxies.txt",
  "https://api.openproxylist.xyz/http.txt",
  "https://api.proxyscrape.com/v2/?request=displayproxies",
  "https://api.proxyscrape.com/?request=displayproxies&proxytype=http",
  "https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all",
  "https://www.proxydocker.com/en/proxylist/download?email=noshare&country=all&city=all&port=all&type=all&anonymity=all&state=all&need=all",
  "https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=anonymous",
  "http://worm.rip/http.txt",
  "https://proxyspace.pro/http.txt",
  "https://multiproxy.org/txt_all/proxy.txt",
  "https://proxy-spider.com/api/proxies.example.txt"
];

async function QuantixFetchProxiesFromSite(site) {
  try {
    const response = await axios.get(site);
    const lines = response.data.split("\n");
    lines.forEach(line => {
      if (line.includes(":")) {
        const [ip, port] = line.split(":", 2);
        QuantixProxies.push(`${ip}:${port}`);
      }
    });
  } catch (error) {
    console.log("\x1b[31m%s\x1b[0m", `Gagal mengambil proxy dari ${site}: ${error.message}`); // Warna merah
  }
}

function drawProgressBar(progress) {
  const barLength = 50;
  const filledLength = Math.round(barLength * progress);
  const filledBar = "█".repeat(filledLength);
  const emptyBar = "░".repeat(barLength - filledLength);
  return `[${filledBar}${emptyBar}] ${(progress * 100).toFixed(2)}%`;
}

async function QuantixFetchAllProxies() {
  console.log("\x1b[36m%s\x1b[0m", "Memulai proses pengambilan proxy..."); // Warna cyan

  const QuantixStartTime = Date.now();

  for (let i = 0; i < QuantixProxySites.length; i++) {
    await QuantixFetchProxiesFromSite(QuantixProxySites[i]);
    const progress = (i + 1) / QuantixProxySites.length;
    process.stdout.write(`\r${drawProgressBar(progress)}`);
  }

  console.log("\n\x1b[32m%s\x1b[0m", "Proses pengambilan proxy selesai."); // Warna hijau

  fs.writeFileSync(QuantixOutputFile, QuantixProxies.join("\n"));
  console.log("\x1b[32m%s\x1b[0m", `Proxies berhasil diambil dan disimpan dalam ${QuantixOutputFile}`); // Warna hijau
  console.log("\x1b[34m%s\x1b[0m", `Total proxy valid: ${QuantixProxies.length}`); // Warna biru

  const QuantixEndTime = Date.now();
  const QuantixExecutionTime = (QuantixEndTime - QuantixStartTime) / 1000;
  console.log("\x1b[33m%s\x1b[0m", `Waktu eksekusi: ${QuantixExecutionTime.toFixed(2)} detik`); // Warna kuning

  console.log("\x1b[35m%s\x1b[0m", "Kredit oleh: t.me/Raptor_code"); // Warna magenta
}

QuantixFetchAllProxies();