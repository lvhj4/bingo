#!/usr/bin/env python3
"""
Verbose scraper: for each color page, list top candidates (img + nearby text),
save candidate lists under scripts/logs/, attempt downloads, and write site_copy_results_verbose.csv
"""
import requests, os, sys, re, csv
from bs4 import BeautifulSoup
from urllib.parse import urljoin, quote_plus

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
LOG_DIR = os.path.join(os.path.dirname(__file__), 'logs')
OUT_CSV = os.path.join(ROOT, 'site_copy_results_verbose.csv')
BASE_URL = 'https://gamefun66.com/collectRank'
HEADERS = {'User-Agent': 'Mozilla/5.0 (compatible; scraper/1.0)'}
TIMEOUT = 20
COLORS = ['大红','金','紫','蓝','绿','白']
MAX_CANDIDATES_PER_COLOR = 50

os.makedirs(LOG_DIR, exist_ok=True)

def normalize_name(name: str) -> str:
    name = (name or '').strip()
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
    for a in soup.find_all('a'):
        text = (a.get_text() or '').strip()
        for c in COLORS:
            if c in text and a.get('href'):
                links[c] = urljoin(BASE_URL, a['href'])
    return links

def extract_candidates(soup, page_url):
    imgs = soup.find_all('img')
    candidates = []
    for img in imgs:
        src = img.get('src') or img.get('data-src')
        if not src:
            continue
        src = urljoin(page_url, src)
        alt = (img.get('alt') or '').strip()
        # collect nearby texts: parent, previous sibling, next sibling
        texts = []
        if img.parent:
            texts.append(img.parent.get_text(separator=' ', strip=True))
        prev = img.find_previous(string=True)
        nxt = img.find_next(string=True)
        for t in (prev, nxt):
            if t and isinstance(t, str):
                texts.append(t.strip())
        snippet = ' | '.join([t for t in texts if t])
        # find Chinese short name
        m = re.search(r'[\u4e00-\u9fff][\u4e00-\u9fff\s\-\d]{0,40}', snippet)
        name = alt or (m.group(0).strip() if m else '')
        if not name:
            name = os.path.splitext(os.path.basename(src.split('?')[0]))[0]
        name = normalize_name(name)
        candidates.append({'src': src, 'alt': alt, 'name': name, 'snippet': snippet})
        if len(candidates) >= MAX_CANDIDATES_PER_COLOR:
            break
    return candidates

def download(url, dest):
    try:
        r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
        r.raise_for_status()
        with open(dest, 'wb') as f:
            f.write(r.content)
        return True, ''
    except Exception as e:
        return False, str(e)

def main():
    print('Fetching base page...')
    try:
        base = get_soup(BASE_URL)
    except Exception as e:
        print('Failed to fetch base:', e); sys.exit(1)

    links = find_filter_links(base)
    for c in COLORS:
        if c not in links:
            links[c] = BASE_URL + '?quality=' + quote_plus(c)

    results = []
    for color, url in links.items():
        print(f'-- Scanning {color}: {url}')
        try:
            soup = get_soup(url)
        except Exception as e:
            print('  fetch failed:', e)
            results.append({'folder': color, 'item': '', 'file': '', 'source': url, 'status': 'fetch_failed', 'message': str(e)})
            continue
        candidates = extract_candidates(soup, url)
        logf = os.path.join(LOG_DIR, f'{normalize_name(color)}_candidates.txt')
        with open(logf, 'w', encoding='utf-8') as lf:
            for i, cnd in enumerate(candidates[:20], start=1):
                lf.write(f"{i}. name={cnd['name']}\n   alt={cnd['alt']}\n   src={cnd['src']}\n   snippet={cnd['snippet']}\n\n")
        print(f'  candidates written: {logf} (count={len(candidates)})')

        # prepare folder
        folder_path = os.path.join(ROOT, color)
        os.makedirs(folder_path, exist_ok=True)

        for cnd in candidates:
            item = cnd['name']
            src = cnd['src']
            ext = os.path.splitext(src.split('?')[0])[1] or '.png'
            outpath = os.path.join(folder_path, item + ext)
            ok, msg = download(src, outpath)
            status = 'downloaded' if ok else 'download_failed'
            results.append({'folder': color, 'item': item, 'file': os.path.join(color, item+ext), 'source': src, 'status': status, 'message': msg})
            print(f"  {color} -> {item} : {status}")

    # write CSV
    with open(OUT_CSV, 'w', newline='', encoding='utf-8') as csvf:
        writer = csv.DictWriter(csvf, fieldnames=['folder','item','file','source','status','message'])
        writer.writeheader()
        for r in results:
            writer.writerow(r)

    print('Done. wrote', OUT_CSV)

if __name__ == '__main__':
    main()
