param(
    [string]$BaseUrl = 'https://gamefun66.com/collectRank',
    [int]$TimeoutSec = 30
)
$ErrorActionPreference = 'Continue'

function Normalize-Name {
    param($name)
    $invalid = [System.IO.Path]::GetInvalidFileNameChars() + [System.IO.Path]::GetInvalidPathChars()
    foreach ($c in $invalid) { $name = $name -replace [regex]::Escape($c), '_' }
    $name = $name.Trim()
    if ($name.Length -gt 120) { $name = $name.Substring(0,120) }
    return $name
}

$headers = @{ 'User-Agent' = 'Mozilla/5.0 (compatible; scraper/1.0)'}

Write-Output "Fetching base page $BaseUrl"
try {
    $home = Invoke-WebRequest -Uri $BaseUrl -UseBasicParsing -TimeoutSec $TimeoutSec -Headers $headers
    $homeHtml = $home.Content
} catch {
    Write-Error "Failed to GET $BaseUrl : $($_.Exception.Message)"
    exit 1
}

# define color display names using Unicode codepoints
$colorMap = @{
    'dahong' = ([char]0x5927) + ([char]0x7EA2)
    'jin'    = ([char]0x91D1)
    'zi'     = ([char]0x7D2B)
    'lan'    = ([char]0x84DD)
    'lv'     = ([char]0x7EFF)
    'bai'    = ([char]0x767D)
}

# construct URLs for each color using query param fallback
$colorLinks = @{}
foreach ($label in $colorMap.Values) {
    $url = "$BaseUrl?quality=" + [System.Uri]::EscapeDataString($label)
    $colorLinks[$label] = $url
}

Write-Output "Will try the following color pages:`n$($colorLinks.GetEnumerator() | ForEach-Object { $_.Key + ' -> ' + $_.Value } -join "`n")"

$results = @()
foreach ($entry in $colorLinks.GetEnumerator()) {
    $color = $entry.Key
    $url = $entry.Value
    Write-Output "Processing color '$color' -> $url"
    try {
        $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec $TimeoutSec -Headers $headers
        $html = $resp.Content
    } catch {
        Write-Warning "Failed to fetch $url : $($_.Exception.Message)"
        $results += [PSCustomObject]@{ Folder = $color; File = ''; SourceUrl = $url; Status = 'fetch_failed'; Message = $_.Exception.Message }
        continue
    }

    # find all <img> tags
    $imgRegex = [regex] '<img[^>]+src=["''](?<src>[^"'']+)["''][^>]*>'
    $matches = $imgRegex.Matches($html)
    if ($matches.Count -eq 0) {
        Write-Warning "No images found on page for $color"
        $results += [PSCustomObject]@{ Folder = $color; File = ''; SourceUrl = $url; Status = 'no_images'; Message = '' }
        continue
    }

    $folder = Join-Path (Get-Location) $color
    if (-not (Test-Path $folder)) { New-Item -ItemType Directory -Path $folder | Out-Null }

    foreach ($m in $matches) {
        $src = $m.Groups['src'].Value
        if ($src -match '^//') { $src = 'https:' + $src }
        if ($src -notmatch '^https?://') { $src = [System.Uri]::new($url, $src).AbsoluteUri }

        # try to find a nearby Chinese name within html around the image position
        $pos = $m.Index
        $start = [math]::Max(0, $pos - 300)
        $length = [math]::Min(600, $html.Length - $start)
        $snippet = $html.Substring($start, $length)
        $name = $null
        $altMatch = [regex]::Match($m.Value, 'alt=["''](?<alt>[^"'']+)["'']')
        if ($altMatch.Success) { $name = $altMatch.Groups['alt'].Value }
        if (-not $name) {
            $cnmatch = [regex]::Match($snippet, '[\u4e00-\u9fff]{2,40}')
            if ($cnmatch.Success) { $name = $cnmatch.Value }
        }
        if (-not $name) { $name = [System.IO.Path]::GetFileNameWithoutExtension($src) }

        $safe = Normalize-Name $name
        $ext = [System.IO.Path]::GetExtension($src)
        if (-not $ext) { $ext = '.png' }
        $outFile = Join-Path $folder ($safe + $ext)
        try {
            Invoke-WebRequest -Uri $src -OutFile $outFile -UseBasicParsing -TimeoutSec $TimeoutSec -Headers $headers -ErrorAction Stop
            $status = 'downloaded'
        } catch {
            $status = 'download_failed: ' + $_.Exception.Message
        }
        $results += [PSCustomObject]@{ Folder = $color; File = $safe + $ext; SourceUrl = $src; Status = $status }
        Write-Output "$color -> $safe : $status"
    }
}

# write results
$out = Join-Path (Get-Location) 'site_copy_results.csv'
$results | ConvertTo-Csv -NoTypeInformation | Out-File -FilePath $out -Encoding UTF8
Write-Output "Wrote results to $out"
param(
    [string]$BaseUrl = 'https://gamefun66.com/collectRank',
    [int]$TimeoutSec = 30
)
$ErrorActionPreference = 'Continue'

function Normalize-Name {
    param($name)
    $invalid = [System.IO.Path]::GetInvalidFileNameChars() + [System.IO.Path]::GetInvalidPathChars()
    foreach ($c in $invalid) { $name = $name -replace [regex]::Escape($c), '_' }
    $name = $name.Trim()
    if ($name.Length -gt 120) { $name = $name.Substring(0,120) }
    return $name
}

$headers = @{ 'User-Agent' = 'Mozilla/5.0 (compatible; scraper/1.0)'}

Write-Output "Fetching base page $BaseUrl"
try {
    $home = Invoke-WebRequest -Uri $BaseUrl -UseBasicParsing -TimeoutSec $TimeoutSec -Headers $headers
    $homeHtml = $home.Content
} catch {
    Write-Error "Failed to GET $BaseUrl : $($_.Exception.Message)"
    exit 1
}

# define color display names using Unicode codepoints
$colorMap = @{
    'dahong' = ([char]0x5927) + ([char]0x7EA2)
    'jin'    = ([char]0x91D1)
    'zi'     = ([char]0x7D2B)
    'lan'    = ([char]0x84DD)
    'lv'     = ([char]0x7EFF)
    'bai'    = ([char]0x767D)
}

# construct URLs for each color using query param fallback
$colorLinks = @{}
foreach ($label in $colorMap.Values) {
    $url = "$BaseUrl?quality=" + [System.Uri]::EscapeDataString($label)
    $colorLinks[$label] = $url
}

Write-Output "Will try the following color pages:`n$($colorLinks.GetEnumerator() | ForEach-Object { $_.Key + ' -> ' + $_.Value } -join "`n")"

$results = @()
foreach ($entry in $colorLinks.GetEnumerator()) {
    $color = $entry.Key
    $url = $entry.Value
    Write-Output "Processing color '$color' -> $url"
    try {
        $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec $TimeoutSec -Headers $headers
        $html = $resp.Content
    } catch {
        Write-Warning "Failed to fetch $url : $($_.Exception.Message)"
        $results += [PSCustomObject]@{ Folder = $color; File = ''; SourceUrl = $url; Status = 'fetch_failed'; Message = $_.Exception.Message }
        continue
    }

    # find all <img> tags
    $imgRegex = [regex] '<img[^>]+src=["''](?<src>[^"'']+)["''][^>]*>'
    $matches = $imgRegex.Matches($html)
    if ($matches.Count -eq 0) {
        Write-Warning "No images found on page for $color"
        $results += [PSCustomObject]@{ Folder = $color; File = ''; SourceUrl = $url; Status = 'no_images'; Message = '' }
        continue
    }

    $folder = Join-Path (Get-Location) $color
    if (-not (Test-Path $folder)) { New-Item -ItemType Directory -Path $folder | Out-Null }

    foreach ($m in $matches) {
        $src = $m.Groups['src'].Value
        if ($src -match '^//') { $src = 'https:' + $src }
        if ($src -notmatch '^https?://') { $src = [System.Uri]::new($url, $src).AbsoluteUri }

        # try to find a nearby Chinese name within html around the image position
        $pos = $m.Index
        $start = [math]::Max(0, $pos - 300)
        $length = [math]::Min(600, $html.Length - $start)
        $snippet = $html.Substring($start, $length)
        $name = $null
        $altMatch = [regex]::Match($m.Value, 'alt=["''](?<alt>[^"'']+)["'']')
        if ($altMatch.Success) { $name = $altMatch.Groups['alt'].Value }
        if (-not $name) {
            $cnmatch = [regex]::Match($snippet, '[\u4e00-\u9fff]{2,40}')
            if ($cnmatch.Success) { $name = $cnmatch.Value }
        }
        if (-not $name) { $name = [System.IO.Path]::GetFileNameWithoutExtension($src) }

        $safe = Normalize-Name $name
        $ext = [System.IO.Path]::GetExtension($src)
        if (-not $ext) { $ext = '.png' }
        $outFile = Join-Path $folder ($safe + $ext)
        try {
            Invoke-WebRequest -Uri $src -OutFile $outFile -UseBasicParsing -TimeoutSec $TimeoutSec -Headers $headers -ErrorAction Stop
            $status = 'downloaded'
        } catch {
            $status = 'download_failed: ' + $_.Exception.Message
        }
        $results += [PSCustomObject]@{ Folder = $color; File = $safe + $ext; SourceUrl = $src; Status = $status }
        Write-Output "$color -> $safe : $status"
    }
}

# write results
$out = Join-Path (Get-Location) 'site_copy_results.csv'
$results | ConvertTo-Csv -NoTypeInformation | Out-File -FilePath $out -Encoding UTF8
Write-Output "Wrote results to $out"

param(
    [string]$BaseUrl = 'https://gamefun66.com/collectRank',
 
} else {
    $names = Get-ChildItem -LiteralPath $imgDir -File | ForEach-Object { $_.Name }
}

# patterns (build grade pattern from color map values plus common words)
$escapedColors = $colorMap.Values | ForEach-Object { [regex]::Escape($_) }
$gradePattern = ($escapedColors -join '|') + '|红色|蓝色|绿色|白色|紫色|金|红|大红'
$valuePattern = '\\d{1,3}(?:,\\d{3})+'  # numbers like 131,460

# headers
$headers = @{ 'User-Agent' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }

$results = @()

foreach ($file in $names) {
    $fileName = [System.IO.Path]::GetFileName($file)
    $base = [System.IO.Path]::GetFileNameWithoutExtension($fileName)
    Write-Output "Processing: $fileName"

    $query = "site:gamefun66.com $base 物品 等级 价格"
    $url = 'https://www.bing.com/search?q=' + [System.Uri]::EscapeDataString($query)
    try {
        $resp = Invoke-WebRequest -Uri $url -Headers $headers -TimeoutSec 20 -UseBasicParsing -ErrorAction Stop
        $content = $resp.Content
    } catch {
        $content = $_.Exception.Message
    }

    # try to find grade
    $grade = $null
    $val = $null
    $m = [regex]::Match($content, $gradePattern, 'IgnoreCase')
    if ($m.Success) { $grade = $m.Value }
    $m2 = [regex]::Match($content, $valuePattern)
    if ($m2.Success) { $val = $m2.Value }

    if (-not $grade -and -not $val) {
        # try searching the site page for the name (fallback)
        $pageUrl = 'https://gamefun66.com/collectRank'
        try {
            $p = Invoke-WebRequest -Uri $pageUrl -Headers $headers -TimeoutSec 20 -UseBasicParsing -ErrorAction Stop
            $page = $p.Content
            if ($page -match [regex]::Escape($base)) {
                # found the name on page; attempt to extract nearby grade/value using a small window
                $idx = $page.IndexOf($base)
                if ($idx -ge 0) {
                    $start = [Math]::Max(0, $idx - 200)
                    $len = [Math]::Min(500, $page.Length - $start)
                    $snippet = $page.Substring($start, $len)
                    $m = [regex]::Match($snippet, $gradePattern, 'IgnoreCase')
                    if ($m.Success) { $grade = $m.Value }
                    $m2 = [regex]::Match($snippet, $valuePattern)
                    if ($m2.Success) { $val = $m2.Value }
                }
            }
        } catch {
        }
    }

    if ($grade -or $val) {
        $gradeClean = if ($grade) { $grade } else { '未知等级' }
        $valClean = if ($val) { $val } else { '未知价格' }
        # folder name: <value>_<grade>
        $folderName = "$valClean`_`$gradeClean"
        $folderPath = Join-Path $root $folderName
        if (-not (Test-Path $folderPath)) { New-Item -ItemType Directory -Path $folderPath | Out-Null }

        # copy local file if exists
        $srcFile = Join-Path $imgDir $fileName
        if (Test-Path $srcFile) {
            try {
                Copy-Item -LiteralPath $srcFile -Destination $folderPath -Force -ErrorAction Stop
                $status = 'copied'
            } catch {
                $status = "copy_failed: $($_.Exception.Message)"
            }
        } else {
            # attempt to download an image from Bing image search result
            $imgStatus = 'no_local_file'
            try {
                $imgQuery = 'https://www.bing.com/images/search?q=' + [System.Uri]::EscapeDataString($base)
                $ir = Invoke-WebRequest -Uri $imgQuery -Headers $headers -TimeoutSec 20 -UseBasicParsing -ErrorAction Stop
                $imgHtml = $ir.Content
                $mimg = [regex]::Match($imgHtml, '"murl"\s*:\s*"([^"]+)"')
                if ($mimg.Success) {
                    $imgUrl = $mimg.Groups[1].Value
                    $ext = '.png'
                    if ($imgUrl -match '\\.(jpg|jpeg|png|gif)(?:[?]|$)') { $ext = '.' + $Matches[1] }
                    $destPath = Join-Path $folderPath ($base + $ext)
                    Invoke-WebRequest -Uri $imgUrl -OutFile $destPath -Headers $headers -TimeoutSec 20 -UseBasicParsing -ErrorAction Stop
                    $imgStatus = 'downloaded'
                } else { $imgStatus = 'img_not_found' }
            } catch {
                $imgStatus = "img_error: $($_.Exception.Message)"
            }
            $status = $imgStatus
        }
    } else {
        $folderName = '未分类'
        $folderPath = Join-Path $root $folderName
        if (-not (Test-Path $folderPath)) { New-Item -ItemType Directory -Path $folderPath | Out-Null }
        # still try to copy local file into 未分类
        $srcFile = Join-Path $imgDir $fileName
        if (Test-Path $srcFile) {
            try { Copy-Item -LiteralPath $srcFile -Destination $folderPath -Force -ErrorAction Stop; $status = 'copied_unclassified' } catch { $status = "copy_failed: $($_.Exception.Message)" }
        } else { $status = 'no_info_no_file' }
    }

    $results += [PSCustomObject]@{ File = $fileName; Value = $val; Grade = $grade; Folder = (Split-Path $folderPath -Leaf); Status = $status }
}

# write CSV
$results | ConvertTo-Csv -NoTypeInformation | Out-File -FilePath $outCsv -Encoding UTF8
Write-Output "Wrote results to $outCsv"

# summary
$summary = $results | Group-Object -Property Status | ForEach-Object { "{0}: {1}" -f $_.Name, $_.Count }
Write-Output "Summary:`n$($summary -join "`n")"

Write-Output "Script end"
