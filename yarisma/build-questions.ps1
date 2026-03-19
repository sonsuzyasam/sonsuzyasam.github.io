# build-questions.ps1
# Kullanim:
#   cd yarisma
#   .\build-questions.ps1
#   .\build-questions.ps1 -ExamId arkeoloji
#
# Desteklenen kaynak yapilari:
#   1) questions/examid.json
#   2) questions/examid/index.json + questions/examid/*.json
#
# Build ciktilari:
#   - data/question-banks.js icine ekler/gunceller
#   - Kod.gs ANSWER_KEYS icine ekler/gunceller

param(
    [string]$ExamId = ''
)

$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$questionsDir = Join-Path $root 'questions'
$questionBanksJs = Join-Path (Join-Path $root 'data') 'question-banks.js'
$kodGs = Join-Path $root 'Kod.gs'

$letterToIndex = @{ A = 0; B = 1; C = 2; D = 3; E = 4 }

function ConvertTo-JsSafeString([string]$text) {
    if ($null -eq $text) { return '' }
    return $text.Replace('\', '\\').Replace("'", "\'").Replace("`r`n", ' ').Replace("`n", ' ').Replace("`r", ' ')
}

function Get-QuestionSourceDefinitions {
    $definitions = @()
    $flatFiles = Get-ChildItem $questionsDir -Filter '*.json' -File -ErrorAction SilentlyContinue

    foreach ($flatFile in $flatFiles) {
        $definitions += [pscustomobject]@{
            ExamId = $flatFile.BaseName.ToLower()
            Type = 'flat'
            Path = $flatFile.FullName
            Meta = $null
        }
    }

    $examFolders = Get-ChildItem $questionsDir -Directory -ErrorAction SilentlyContinue
    foreach ($folder in $examFolders) {
        $indexPath = Join-Path $folder.FullName 'index.json'
        if (-not (Test-Path $indexPath)) { continue }

        $metaRaw = Get-Content $indexPath -Encoding UTF8 -Raw
        $meta = $metaRaw | ConvertFrom-Json

        $definitions = $definitions | Where-Object { $_.ExamId -ne $folder.Name.ToLower() }
        $definitions += [pscustomobject]@{
            ExamId = $folder.Name.ToLower()
            Type = 'folder'
            Path = $folder.FullName
            Meta = $meta
        }
    }

    if ($ExamId) {
        $definitions = $definitions | Where-Object { $_.ExamId -eq $ExamId.ToLower() }
    }

    return $definitions | Sort-Object ExamId
}

function Get-QuestionsFromFlatFile($filePath) {
    $raw = Get-Content $filePath -Encoding UTF8 -Raw
    $items = $raw | ConvertFrom-Json
    return @($items)
}

function Get-QuestionsFromFolder($folderPath, $meta) {
    $questions = @()
    $packFiles = @()

    if ($meta -and $meta.packs) {
        foreach ($pack in $meta.packs) {
            $packPath = Join-Path $folderPath $pack.file
            if (-not (Test-Path $packPath)) {
                throw "Pack dosyasi bulunamadi: $packPath"
            }
            $packFiles += $packPath
        }
    } else {
        $packFiles = Get-ChildItem $folderPath -Filter '*.json' -File | Where-Object { $_.Name -ne 'index.json' } | Select-Object -ExpandProperty FullName
    }

    foreach ($packFile in $packFiles) {
        $raw = Get-Content $packFile -Encoding UTF8 -Raw
        $packQuestions = $raw | ConvertFrom-Json
        $questions += @($packQuestions)
    }

    return $questions
}

function Validate-Question($question, [string]$examId, [string]$originLabel, $seenIds, $seenTexts) {
    if (-not $question.id) {
        throw "[$examId][$originLabel] id eksik"
    }

    $questionId = [string]$question.id
    if ($seenIds.ContainsKey($questionId)) {
        throw "[$examId][$originLabel] tekrar eden id: $questionId"
    }
    $seenIds[$questionId] = $true

    if (-not $question.question) {
        throw "[$examId][$originLabel][$questionId] question eksik"
    }

    $normalizedText = ([string]$question.question).Trim().ToLower()
    if ($seenTexts.ContainsKey($normalizedText)) {
        throw "[$examId][$originLabel][$questionId] tekrar eden soru metni"
    }
    $seenTexts[$normalizedText] = $true

    if (-not $question.options) {
        throw "[$examId][$originLabel][$questionId] options eksik"
    }

    foreach ($key in @('A', 'B', 'C', 'D', 'E')) {
        if (-not $question.options.$key) {
            throw "[$examId][$originLabel][$questionId] $key secenegi eksik"
        }
    }

    $answer = ([string]$question.answer).ToUpper()
    if (-not $letterToIndex.ContainsKey($answer)) {
        throw "[$examId][$originLabel][$questionId] answer A-E olmali"
    }

    if ([string]::IsNullOrWhiteSpace([string]$question.rationale)) {
        throw "[$examId][$originLabel][$questionId] rationale zorunlu"
    }

    if ([string]::IsNullOrWhiteSpace([string]$question.sourceUrl)) {
        throw "[$examId][$originLabel][$questionId] sourceUrl zorunlu"
    }

    $reviewStatus = [string]$question.reviewStatus
    if ($reviewStatus -and $reviewStatus -ne 'approved') {
        throw "[$examId][$originLabel][$questionId] reviewStatus approved olmali"
    }
}

function Normalize-Questions($questions, [string]$examId, [string]$originLabel) {
    $seenIds = @{}
    $seenTexts = @{}
    $approved = @()

    foreach ($question in $questions) {
        Validate-Question -question $question -examId $examId -originLabel $originLabel -seenIds $seenIds -seenTexts $seenTexts

        $reviewStatus = [string]$question.reviewStatus
        if ([string]::IsNullOrWhiteSpace($reviewStatus) -or $reviewStatus -eq 'approved') {
            $approved += $question
        }
    }

    return $approved
}

function Convert-ToJsEntry($question) {
    $options = @(
        $question.options.A,
        $question.options.B,
        $question.options.C,
        $question.options.D,
        $question.options.E
    )

    $optionsJs = ($options | ForEach-Object { "'$(ConvertTo-JsSafeString ([string]$_))'" }) -join ', '
    $correctIndex = $letterToIndex[[string]$question.answer.ToUpper()]
    $topic = if ($question.subject) { ConvertTo-JsSafeString (([string]$question.subject) -replace '\s*-\s*.*$', '') } else { 'Genel' }
    $difficulty = if ($question.difficulty) { ConvertTo-JsSafeString ([string]$question.difficulty) } else { 'Orta' }
    $text = ConvertTo-JsSafeString ([string]$question.question)
    $rationale = ConvertTo-JsSafeString ([string]$question.rationale)
    $sourceUrl = ConvertTo-JsSafeString ([string]$question.sourceUrl)
    $sourceTitle = ConvertTo-JsSafeString ([string]$question.sourceTitle)

    return "        { id: '$($question.id)', topic: '$topic', difficulty: '$difficulty', text: '$text', options: [$optionsJs], correctIndex: $correctIndex, rationale: '$rationale', sourceUrl: '$sourceUrl', sourceTitle: '$sourceTitle' }"
}

function Update-QuestionBank([string]$examId, $questions) {
    $jsLines = $questions | ForEach-Object { Convert-ToJsEntry $_ }
    $jsBlock = "    ${examId}: [`n$($jsLines -join ",`n")`n    ]"

    $content = Get-Content $questionBanksJs -Encoding UTF8 -Raw

    if ($content -match "(?m)^\s{4}${examId}:\s*\[") {
        $lines = $content -split "`n"
        $start = -1
        $end = -1
        $depth = 0

        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($start -eq -1 -and $lines[$i] -match "^\s{4}${examId}:\s*\[") {
                $start = $i
                $depth = 1
                continue
            }

            if ($start -ge 0) {
                $depth += ($lines[$i].ToCharArray() | Where-Object { $_ -eq '[' }).Count
                $depth -= ($lines[$i].ToCharArray() | Where-Object { $_ -eq ']' }).Count
                if ($depth -le 0) {
                    $end = $i
                    break
                }
            }
        }

        if ($start -ge 0 -and $end -ge 0) {
            $before = if ($start -gt 0) { ($lines[0..($start - 1)]) -join "`n" } else { '' }
            $after = if ($end + 1 -lt $lines.Count) { ($lines[($end + 1)..($lines.Count - 1)]) -join "`n" } else { '' }
            $content = @($before, $jsBlock, $after) -join "`n"
        }
    } else {
        $content = $content -replace '(\s*\};\s*)$', ",`n$jsBlock`n`$1"
    }

    Set-Content $questionBanksJs $content -Encoding UTF8 -NoNewline
}

function Update-AnswerKeys([string]$examId, $questions) {
    $gsLines = $questions | ForEach-Object {
        $idx = $letterToIndex[[string]$_.answer.ToUpper()]
        "    '$($_.id)':$idx"
    }

    $gsBlock = "  ${examId}: {`n$($gsLines -join ",`n")`n  }"
    $content = Get-Content $kodGs -Encoding UTF8 -Raw

    if ($content -match "(?m)^\s{2}${examId}:\s*\{") {
        $content = $content -replace "(?s)\s{2}${examId}:\s*\{[^}]*\}", "`n  $($gsBlock.TrimStart())"
    } else {
        $content = $content -replace '(};(\s*)// ={5,}\s*// GİRİŞ)', "},`n$gsBlock`n`$1"
        if ($content -notmatch [regex]::Escape($gsBlock)) {
            $content = $content -replace "(  english: \{[^}]+\})", "`$1,`n$gsBlock"
        }
    }

    Set-Content $kodGs $content -Encoding UTF8 -NoNewline
}

$sources = @(Get-QuestionSourceDefinitions)
if (@($sources).Count -eq 0) {
    throw 'questions altinda build edilecek kaynak bulunamadi.'
}

foreach ($source in $sources) {
    if ($source.Type -eq 'flat') {
        $loadedQuestions = Get-QuestionsFromFlatFile -filePath $source.Path
        $originLabel = Split-Path $source.Path -Leaf
    } else {
        $loadedQuestions = Get-QuestionsFromFolder -folderPath $source.Path -meta $source.Meta
        $originLabel = Split-Path $source.Path -Leaf
    }

    $questions = Normalize-Questions -questions $loadedQuestions -examId $source.ExamId -originLabel $originLabel
    if (-not $questions.Count) {
        throw "[$($source.ExamId)] onayli soru bulunamadi"
    }

    Write-Host "=== $($source.ExamId) ($($questions.Count) soru) ===" -ForegroundColor Cyan
    Update-QuestionBank -examId $source.ExamId -questions $questions
    Write-Host "  question-banks.js: '$($source.ExamId)' guncellendi." -ForegroundColor Green

    Update-AnswerKeys -examId $source.ExamId -questions $questions
    Write-Host "  Kod.gs: '$($source.ExamId)' answer key guncellendi." -ForegroundColor Green
    Write-Host ''
}

Write-Host 'Tamamlandi! Apps Scripti yeniden dagitin.' -ForegroundColor Cyan
