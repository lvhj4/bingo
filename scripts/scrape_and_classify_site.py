#!/usr/bin/env python3
"""
Scrape gamefun66 collectRank and download images into folders named by filter (颜色).
Creates site_copy_results.csv in repo root with columns: folder,item,file,source,status,message
"""
import requests
from bs4 import BeautifulSoup
import os, sys, csv, time, re
from urllib.parse import urljoin, quote_plus

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT_CSV = os.path.join(ROOT, 'site_copy_results.csv')
BASE_URL = 'https://gamefun66.com/collectRank'
HEADERS = {'User-Agent': 'Mozilla/5.0 (compatible; scraper/1.0)'}
TIMEOUT = 20
COLORS = ['大红','金','紫','蓝','绿','白']

def normalize_name(name: str) -> str:
    name = name.strip()
    name = re.sub(r'[\\/:*?"<>|]', '_', name)
    if len(name) > 120:
        name = name[:120]
    return name

def get_soup(url):
    r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
    r.encoding = r.apparent_encoding or 'utf-8'
    return BeautifulSoup(r.text, 'lxml')

def find_filter_links(soup):
    links = {}
    # try anchors whose text contains color names
    for a in soup.find_all('a'):
        text = (a.get_text() or '').strip()
        for c in COLORS:
            if c in text and a.get('href'):
                href = urljoin(BASE_URL, a['href'])
                links[c] = href
    return links

def scan_color_page(color, url):
    rows = []
    try:
        soup = get_soup(url)
    except Exception as e:
        return rows, f'fetch_failed: {e}'

    # find item blocks: look for elements with an img and a nearby Chinese name
    images = soup.find_all('img')
    seen = set()
    for img in images:
        src = img.get('src') or img.get('data-src')
        if not src:
            continue
        src = urljoin(url, src)
        # name from alt first
        name = img.get('alt')
        if not name:
            # try parent text
            parent = img.parent
            if parent:
                text = parent.get_text(separator=' ').strip()
                m = re.search(r'[\u4e00-\u9fff][\u4e00-\u9fff\s\-\d]{0,40}', text)
                if m:
                    name = m.group(0).strip()
        if not name:
            # try next sibling
            sib = img.find_next_sibling(text=True)
            if sib:
                s = sib.strip()
                if re.search(r'[\u4e00-\u9fff]', s):
                    name = s
        if not name:
            # fallback to filename
            name = os.path.splitext(os.path.basename(src))[0]

        name = normalize_name(name)
        key = (color, name)
        if key in seen:
            continue
        seen.add(key)
        rows.append({'folder': color, 'item': name, 'src': src})

    return rows, 'ok'

def ensure_dir(path):
    os.makedirs(path, exist_ok=True)

def download_item(folder, item, src):
    ensure_dir(folder)
    # choose extension
    ext = os.path.splitext(src.split('?')[0])[1]
    if not ext:
        ext = '.png'
    out = os.path.join(folder, item + ext)
    try:
        r = requests.get(src, headers=HEADERS, timeout=TIMEOUT)
        r.raise_for_status()
        with open(out, 'wb') as f:
            f.write(r.content)
        return 'downloaded', ''
    except Exception as e:
        return 'download_failed', str(e)

def main():
    print('Fetching base page...')
    try:
        base_soup = get_soup(BASE_URL)
    except Exception as e:
        print('Failed to fetch base page:', e)
        sys.exit(1)

    links = find_filter_links(base_soup)
    # fallback: construct query URLs
    for c in COLORS:
        if c not in links:
            links[c] = BASE_URL + '?quality=' + quote_plus(c)

    print('Color pages to scan:')
    for k,v in links.items():
        print(' -', k, v)

    results = []
    for color, url in links.items():
        print(f'Scanning {color} ...')
        rows, status = scan_color_page(color, url)
        if status != 'ok':
            results.append({'folder': color, 'item': '', 'file': '', 'source': url, 'status': status, 'message': ''})
            continue
        folder_path = os.path.join(ROOT, color)
        ensure_dir(folder_path)
        for r in rows:
            item = r['item']
            src = r['src']
            s, msg = download_item(folder_path, item, src)
            results.append({'folder': color, 'item': item, 'file': os.path.join(color, item), 'source': src, 'status': s, 'message': msg})
            print(f"{color} -> {item} : {s}")

    # write CSV
    with open(OUT_CSV, 'w', newline='', encoding='utf-8') as csvf:
        writer = csv.DictWriter(csvf, fieldnames=['folder','item','file','source','status','message'])
        writer.writeheader()
        for row in results:
            writer.writerow(row)

    print('Done. Wrote', OUT_CSV)

if __name__ == '__main__':
    main()
