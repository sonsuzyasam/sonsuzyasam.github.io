# build-questions.ps1
# Kullanim: cd yarisma; .\build-questions.ps1
#
# questions/*.json kaynak dosyalarini okuyup:
#   - data/question-banks.js icine ekler/gunceller
#   - Kod.gs ANSWER_KEYS icine ekler/gunceller
#
# Kaynak format (questions/examid.json):
# [{ "id", "subject", "difficulty", "question", "options": {"A".."E"}, "answer": "B", "rationale" }]

param(
    [string]$ExamId = ''   # Belirli bir sinavi guncellemek icin: .\build-questions.ps1 -ExamId arkeoloji
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$questionsDir    = Join-Path $root 'questions'
$questionBanksJs = Join-Path $root 'data' 'question-banks.js'
$kodGs           = Join-Path $root 'Kod.gs'

$letterToIndex = @{ A=0; B=1; C=2; D=3; E=4 }

function Escape-JsString([string]$s) {
    $s.Replace('\','\\').Replace("'","\'").Replace("`r`n",' ').Replace("`n",' ').Replace("`r",' ')
}

function Convert-ToJsEntry($q) {
    $opts = @($q.options.A, $q.options.B, $q.options.C, $q.options.D, $q.options.E) | Where-Object { $_ -ne $null }
    $optsJs    = ($opts | ForEach-Object { "'$(Escape-JsString $_)'" }) -join ', '
    $idx       = $letterToIndex[$q.answer.ToUpper()]
    $topic     = Escape-JsString ($q.subject -replace '\s*-\s*.*$','')   # "Neolitik Cag - Ozellikler" -> "Neolitik Cag"
    $text      = Escape-JsString $q.question
    $diff      = if ($q.difficulty) { Escape-JsString $q.difficulty } else { 'Orta' }
    $rationale = if ($q.rationale)  { ", rationale: '$(Escape-JsString $q.rationale)'" } else { '' }
    return "        { id: '$($q.id)', topic: '$topic', difficulty: '$diff', text: '$text', options: [$optsJs], correctIndex: $idx$rationale }"
}

$files = Get-ChildItem $questionsDir -Filter '*.json'
if ($ExamId) { $files = $files | Where-Object { $_.BaseName -eq $ExamId } }

foreach ($file in $files) {
    $examId   = $file.BaseName.ToLower()
    $raw      = Get-Content $file.FullName -Encoding UTF8 -Raw
    $questions = $raw | ConvertFrom-Json

    Write-Host "=== $($file.Name) ($($questions.Count) soru) ===" -ForegroundColor Cyan

    # ----- question-banks.js -----
    $jsLines  = $questions | ForEach-Object { Convert-ToJsEntry $_ }
    $jsBlock  = "    ${examId}: [`n$($jsLines -join ",`n")`n    ]"

    $qbContent = Get-Content $questionBanksJs -Encoding UTF8 -Raw

    if ($qbContent -match "(?m)^\s{4}${examId}:\s*\[") {
        # Mevcut blogu bul ve replace et (satir bazli)
        $lines  = $qbContent -split "`n"
        $start  = -1; $end = -1; $depth = 0
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($start -eq -1 -and $lines[$i] -match "^\s{4}${examId}:\s*\[") { $start = $i; $depth = 1; continue }
            if ($start -ge 0) {
                $depth += ($lines[$i].ToCharArray() | Where-Object { $_ -eq '[' }).Count
                $depth -= ($lines[$i].ToCharArray() | Where-Object { $_ -eq ']' }).Count
                if ($depth -le 0) { $end = $i; break }
            }
        }
        if ($start -ge 0 -and $end -ge 0) {
            $before = ($lines[0..($start-1)]) -join "`n"
            $after  = ($lines[($end+1)..($lines.Count-1)]) -join "`n"
            $qbContent = "$before`n$jsBlock$after"
            Set-Content $questionBanksJs $qbContent -Encoding UTF8 -NoNewline
            Write-Host "  question-banks.js: '$examId' guncellendi." -ForegroundColor Green
        }
    } else {
        # Sonuna ekle (kapanan }; onune)
        $qbContent = $qbContent -replace '(\s*\};\s*)$', ",`n$jsBlock`n`$1"
        Set-Content $questionBanksJs $qbContent -Encoding UTF8 -NoNewline
        Write-Host "  question-banks.js: '$examId' eklendi." -ForegroundColor Green
    }

    # ----- Kod.gs ANSWER_KEYS -----
    $gsLines = $questions | ForEach-Object {
        $idx = $letterToIndex[$_.answer.ToUpper()]
        "    '$($_.id)':$idx"
    }
    $gsBlock = "  ${examId}: {`n$($gsLines -join ",`n")`n  }"

    $gsContent = Get-Content $kodGs -Encoding UTF8 -Raw

    if ($gsContent -match "(?m)^\s{2}${examId}:\s*\{") {
        Write-Host "  Kod.gs: '$examId' zaten mevcut, guncelleniyor..." -ForegroundColor Yellow
        # Blogu replace et
        $gsContent = $gsContent -replace "(?s)\s{2}${examId}:\s*\{[^}]*\}", "`n  $($gsBlock.TrimStart())"
        Set-Content $kodGs $gsContent -Encoding UTF8 -NoNewline
    } else {
        # ANSWER_KEYS kapanma } oncesine ekle
        $gsContent = $gsContent -replace '(};(\s*)// ={5,}\s*// GİRİŞ)', "},`n$gsBlock`n`$1"
        if ($gsContent -notmatch $gsBlock.Replace('+','\\+')) {
            # Fallback: english blogundan sonra ekle
            $gsContent = $gsContent -replace "(  english: \{[^}]+\})", "`$1,`n$gsBlock"
        }
        Set-Content $kodGs $gsContent -Encoding UTF8 -NoNewline
        Write-Host "  Kod.gs: '$examId' answer key eklendi." -ForegroundColor Green
    }

    Write-Host ""
}

Write-Host "Tamamlandi! Apps Script'i yeniden dagitin." -ForegroundColor Cyan
