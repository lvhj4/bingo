$ErrorActionPreference = 'Continue'
# use repository root (parent of the scripts folder)
$root = (Get-Item $PSScriptRoot).Parent.FullName
$candidate = Get-ChildItem -Path $root -Directory | Where-Object { (Get-ChildItem -LiteralPath $_.FullName -Filter *.png -File -ErrorAction SilentlyContinue).Count -gt 0 } | Select-Object -First 1
if ($null -eq $candidate) {
    Write-Error "Could not find a subdirectory under $root that contains PNG files."
    exit 1
}
$src = $candidate.FullName
# build Chinese folder names from Unicode code points to avoid file-encoding issues
$dirNames = @{
    'red'    = ([char]0x7EA2) + ([char]0x8272)   # 红色
    'purple' = ([char]0x7D2B) + ([char]0x8272)   # 紫色
    'blue'   = ([char]0x84DD) + ([char]0x8272)   # 蓝色
    'green'  = ([char]0x7EFF) + ([char]0x8272)   # 绿色
    'white'  = ([char]0x767D) + ([char]0x8272)   # 白色
}

# patterns to search for (both Chinese words and English color names)
$colors = @{
    'red'    = '红|红色|red'
    'purple' = '紫|紫色|紫罗兰|purple'
    'blue'   = '蓝|蓝色|blue'
    'green'  = '绿|绿色|green'
    'white'  = '白|白色|white'
}
# create target dirs
$createdDirs = @{}
foreach ($key in $colors.Keys) {
    $display = $dirNames[$key]
    $dir = Join-Path $root $display
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
    $createdDirs[$key] = $dir
}
$results = @()
$files = Get-ChildItem -LiteralPath $src -File | Sort-Object Name
Write-Output "Found $($files.Count) files in $src"
foreach ($f in $files) {
    $basename = $f.BaseName
    $filepath = $f.FullName
    $query = "$basename 颜色"
    $url = 'https://www.bing.com/search?q=' + [System.Uri]::EscapeDataString($query)
    Write-Output "Querying: $query"
    try {
        $resp = Invoke-WebRequest -Uri $url -TimeoutSec 15 -ErrorAction Stop
        $text = $resp.Content
    } catch {
        $text = $_.Exception.Message
    }
    $found = $null
    foreach ($c in $colors.Keys) {
        $pattern = $colors[$c]
        if ($text -match $pattern) { $found = $c; break }
    }
    if ($found) {
        $destDir = $createdDirs[$found]
        try {
            Copy-Item -LiteralPath $filepath -Destination $destDir -Force -ErrorAction Stop
            $status = 'copied'
        } catch {
            $status = "copy_failed: $($_.Exception.Message)"
        }
    } else {
        $status = 'no_color_found'
    }
    $results += [PSCustomObject]@{ File = $f.Name; Color = $found; Status = $status }
}
# write results to repo root
$outCsv = Join-Path $root 'copy_results.csv'
$results | ConvertTo-Csv -NoTypeInformation | Out-File -FilePath $outCsv -Encoding UTF8
Write-Output "Wrote results to $outCsv"
# summary
$summary = $results | Group-Object -Property Status | ForEach-Object { "{0}: {1}" -f $_.Name, $_.Count }
Write-Output "Summary:`n$($summary -join "`n")"
