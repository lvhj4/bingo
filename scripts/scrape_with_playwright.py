#!/usr/bin/env python3
"""
Scrape gamefun66 using Playwright and download only the visible table rows
for the selected quality filter(s). Images are saved under the selected color
folder and named by the item name.
"""
import argparse
import csv
import os
import re
from urllib.parse import urljoin

import requests
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT_CSV = os.path.join(ROOT, 'site_copy_results_playwright.csv')
LOG_DIR = os.path.join(os.path.dirname(__file__), 'logs')
os.makedirs(LOG_DIR, exist_ok=True)
BASE_URL = 'https://gamefun66.com/collectRank'
HEADERS = {'User-Agent': 'Mozilla/5.0 (compatible; scraper/1.0)'}
COLORS = ['大红','金','紫','蓝','绿','白']


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--color', action='append', choices=COLORS, help='Only scrape the specified color. Can be passed multiple times.')
    parser.add_argument('--clean', action='store_true', help='Remove existing files in target color folders before downloading.')
    return parser.parse_args()

def normalize_name(name: str) -> str:
    if not name:
        return ''
    name = name.strip()
    name = re.sub(r'[\\/:*?"<>|]', '_', name)
    if len(name) > 120:
        name = name[:120]
    return name

def download(url, dest):
    try:
        r = requests.get(url, headers=HEADERS, timeout=20)
        r.raise_for_status()
        with open(dest, 'wb') as f:
            f.write(r.content)
        return True, ''
    except Exception as e:
        return False, str(e)


def clear_folder(folder):
    if not os.path.isdir(folder):
        return
    for name in os.listdir(folder):
        path = os.path.join(folder, name)
        if os.path.isfile(path):
            os.remove(path)


def extract_items(page):
    return page.evaluate(r'''() => {
        const rootEl = Array.from(document.querySelectorAll('*')).find(el => '__vue_app__' in el);
        if (!rootEl || !rootEl.__vue_app__) return [];

        const rootComp = rootEl.__vue_app__._container._vnode.component;
        let tableComp = null;

        function visit(comp) {
            if (!comp || tableComp) return;
            const name = comp.type && (comp.type.name || comp.type.__name || comp.type.__file || 'anon');
            if (name === 'ATable' && Array.isArray(comp.props?.dataSource)) {
                tableComp = comp;
                return;
            }

            const vnode = comp.subTree;
            function collect(v) {
                if (!v || tableComp) return;
                if (v.component) visit(v.component);
                if (Array.isArray(v.children)) {
                    for (const child of v.children) collect(child);
                }
                if (v.suspense && v.suspense.activeBranch) collect(v.suspense.activeBranch);
            }
            collect(vnode);
        }

        visit(rootComp);
        if (!tableComp) return [];

        return tableComp.props.dataSource.map(row => ({
            name: (row.name || '').trim(),
            src: row.pre_pic || '',
            grade: row.grade,
            objectId: row.object_id || ''
        })).filter(row => row.name && row.src);
    }''')

def run():
    args = parse_args()
    target_colors = args.color or COLORS
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_default_navigation_timeout(60000)

        for color in target_colors:
            print(f'Filtering {color}')
            try:
                page.goto(BASE_URL)
                page.wait_for_load_state('networkidle')
                page.get_by_role('radio', name=color).check()
                page.get_by_role('button', name=re.compile(r'查\s*询')).click()
                page.locator('table tbody tr').first.wait_for(timeout=10000)
            except Exception as e:
                print('  failed to filter', e)
                results.append({'folder': color, 'item': '', 'file': '', 'source': BASE_URL, 'status': 'page_filter_failed', 'message': str(e)})
                continue

            color_to_use = color

            items = extract_items(page)

            folder = os.path.join(ROOT, color_to_use)
            os.makedirs(folder, exist_ok=True)
            if args.clean:
                clear_folder(folder)

            seen = set()
            for it in items:
                src = it.get('src') or ''
                rawname = it.get('name') or ''
                name = rawname.strip() or os.path.splitext(os.path.basename(src.split('?')[0]))[0]
                name = normalize_name(name)
                if not name or name == '收集品':
                    continue
                key = (color_to_use, name)
                if key in seen:
                    continue
                seen.add(key)
                ext = os.path.splitext(src.split('?')[0])[1] or '.png'
                outpath = os.path.join(folder, name + ext)
                ok, msg = download(src, outpath)
                status = 'downloaded' if ok else 'download_failed'
                results.append({'folder': color_to_use, 'item': name, 'file': os.path.join(color_to_use, name + ext), 'source': src, 'status': status, 'message': msg})
                print(f'  {color_to_use} -> {name} : {status}')

        browser.close()

    # write CSV
    with open(OUT_CSV, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['folder','item','file','source','status','message'])
        writer.writeheader()
        for r in results:
            writer.writerow(r)
    print('Wrote', OUT_CSV)

if __name__ == '__main__':
    run()
