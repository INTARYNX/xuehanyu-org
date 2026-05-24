$projectRoot = "$PSScriptRoot\.."
$hskDir      = "$projectRoot\download-data\hsk-vocabulary"
$cfdictDir   = "$projectRoot\download-data\CFDICT"
$outputDir   = "$projectRoot\data"

# =========================
# 1. Download HSK Vocabulary
# =========================
if (!(Test-Path $hskDir)) { New-Item -ItemType Directory -Path $hskDir | Out-Null }

$hskBaseUrl = "https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/refs/heads/main/wordlists/exclusive/newest"

1..6 | ForEach-Object {
    $file = "$_.json"
    Write-Host "Downloading HSK $file ..."
    Invoke-WebRequest -Uri "$hskBaseUrl/$file" -OutFile "$hskDir\$file"
}

# =========================
# 2. Download & Extract CFDICT
# =========================
if (!(Test-Path $cfdictDir)) { New-Item -ItemType Directory -Path $cfdictDir | Out-Null }

$cfdictZip = "$cfdictDir\CFDICT.zip"
Write-Host "Downloading CFDICT ..."
Invoke-WebRequest -Uri "https://chine.in/mandarin/open/CFDICT/download.php?file=xml" -OutFile $cfdictZip
Write-Host "Extracting CFDICT ..."
Expand-Archive -Path $cfdictZip -DestinationPath $cfdictDir -Force
Remove-Item $cfdictZip

# =========================
# 3. French Fallback
# =========================
$frenchFallback = @{
    "面条儿"  = @("nouilles")
    "聊天儿"  = @("bavarder; discuter")
    "大赛"    = @("grand concours; grande competition")
    "起到"    = @("jouer un role; avoir un effet")
    "网友"    = @("ami en ligne; internaute")
    "电子版"  = @("version electronique; version numerique")
    "没法儿"  = @("ne pas pouvoir; etre dans l'impossibilite de")
    "保暖"    = @("garder au chaud; conserver la chaleur")
    "大伙儿"  = @("tout le monde; tous ensemble")
    "倒车"    = @("faire marche arriere; reculer")
    "低碳"    = @("faible teneur en carbone; bas carbone")
    "家家户户" = @("chaque famille; tous les foyers")
    "下功夫"  = @("faire des efforts; travailler dur")
    "限于"    = @("limite a; restreint a")
    "小偷儿"  = @("voleur; pickpocket")
    "也好"    = @("c'est bien aussi; peu importe")
    "至关重要" = @("d'une importance capitale; crucial")
}

# =========================
# 4. Build French Lookup from CFDICT
# =========================
Write-Host "Loading CFDICT ..."
[xml]$cfdict = Get-Content "$cfdictDir\cfdict.xml" -Raw -Encoding UTF8

$frenchLookup = @{}
foreach ($word in $cfdict.dic.word) {
    $simp = $word.simp
    if (-not $frenchLookup.ContainsKey($simp)) { $frenchLookup[$simp] = @() }
    $frenchLookup[$simp] += $word.trans.fr | ForEach-Object { $_.InnerText }
}

# =========================
# 5. Generate data/hsk*.json
# =========================
if (!(Test-Path $outputDir)) { New-Item -ItemType Directory -Path $outputDir | Out-Null }

1..6 | ForEach-Object {
    $level      = $_
    $hskPath    = "$hskDir\$level.json"
    $outputPath = "$outputDir\hsk$level.json"

    if (-not (Test-Path $hskPath)) {
        Write-Warning "HSK ${level}: file not found ($hskPath)"
        return
    }

    $hsk     = Get-Content $hskPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $missing = [System.Collections.Generic.List[string]]::new()

    $result = foreach ($entry in $hsk) {
        $simplified = $entry.simplified
        $form       = $entry.forms[0]

        $french = if ($frenchLookup.ContainsKey($simplified)) {
            $frenchLookup[$simplified]
        } elseif ($frenchFallback.ContainsKey($simplified)) {
            $frenchFallback[$simplified]
        } else {
            $missing.Add($simplified)
            @()
        }

        [PSCustomObject]@{
            simplified  = $simplified
            traditional = $form.traditional
            radical     = $entry.radical
            frequency   = $entry.frequency
            pos         = $entry.pos
            pinyin      = $form.transcriptions.pinyin
            classifiers = $form.classifiers
            english     = $form.meanings
            french      = $french
        }
    }

    $result | ConvertTo-Json -Depth 5 | Set-Content $outputPath -Encoding UTF8

    Write-Host "HSK ${level}: $($result.Count) entries -> $outputPath"
    if ($missing.Count -gt 0) {
        Write-Warning "  Missing French ($($missing.Count)): $($missing -join ', ')"
    }
}

Write-Host "Done. Files in '$outputDir'"
