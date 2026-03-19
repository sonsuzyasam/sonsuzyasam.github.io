param(
    [string]$InputCsv = (Join-Path (Join-Path $PSScriptRoot 'questions\arkeoloji') 'source-manifest.sample.csv'),
    [string]$OutputJson = (Join-Path (Join-Path $PSScriptRoot 'questions\arkeoloji') 'fact-cards-batch.json')
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $InputCsv)) {
    throw "Input CSV bulunamadi: $InputCsv"
}

function Get-PageTitleOrFallback([string]$url, [string]$fallback) {
    if ($fallback) { return $fallback }
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 20
        $match = [regex]::Match($response.Content, '<title>(.*?)</title>', 'IgnoreCase, Singleline')
        if ($match.Success) {
            return ($match.Groups[1].Value -replace '\s+', ' ').Trim()
        }
    } catch {
    }
    return 'Baslik doldurulmadi'
}

function New-FactCard($row, [int]$index) {
    $title = Get-PageTitleOrFallback -url $row.url -fallback $row.title
    $topic = if ($row.topic) { $row.topic } else { 'Genel Arkeoloji' }
    $period = if ($row.period) { $row.period } else { 'Belirtilmedi' }
    $region = if ($row.region) { $row.region } else { 'Belirtilmedi' }
    $difficultyHint = if ($row.difficultyHint) { $row.difficultyHint } else { 'Orta' }

    return [ordered]@{
        sourceId = ('arkbiz_{0:d4}' -f $index)
        url = $row.url
        title = $title
        topic = $topic
        period = $period
        region = $region
        difficultyHint = $difficultyHint
        facts = @(
            'Makaledeki birincil bilgi parcasi',
            'Makaledeki ikincil bilgi parcasi',
            'Makaledeki karsilastirmaya uygun bilgi parcasi'
        )
        candidateQuestionAngles = @(
            'temel kavram',
            'yanlisi bul',
            'karsilastirma',
            'donem ozelligi'
        )
    }
}

$rows = Import-Csv -Path $InputCsv
$result = @()
$counter = 1
foreach ($row in $rows) {
    if (-not $row.url) { continue }
    $result += New-FactCard -row $row -index $counter
    $counter += 1
}

$result | ConvertTo-Json -Depth 6 | Set-Content -Path $OutputJson -Encoding UTF8
Write-Host "Fact-card batch olusturuldu: $OutputJson" -ForegroundColor Green
