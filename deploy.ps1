# Deploy the entire repository root to $REMOTE_DIR
# Excludes ONLY patterns defined in .webignore (ignores .gitignore for deployment)
# Also commits + pushes to Git before deploy

param([switch]$Full)   # -Full : renvoie tout (par défaut, seuls les fichiers modifiés sont envoyés)

# ── Load local config ─────────────────────────────────────────────────────────

$configFile = Join-Path $PSScriptRoot 'deploy.config.ps1'

if (-not (Test-Path $configFile)) {
    Write-Error @"
Missing deploy.config.ps1. Create one in the project root with:

    `$SSH_USER   = 'your-user'
    `$SSH_HOST   = 'your.host'
    `$SSH_KEY    = "`$env:USERPROFILE\.ssh\id_rsa"
    `$REMOTE_DIR = '/opt/www/xuehanyu_org'

This file should stay gitignored.
"@
    exit 1
}

. $configFile

foreach ($v in @('SSH_USER', 'SSH_HOST', 'SSH_KEY')) {
    if (-not (Get-Variable -Name $v -ValueOnly -ErrorAction SilentlyContinue)) {
        Write-Error "deploy.config.ps1 is missing required variable: `$$v"
        exit 1
    }
}

# Sécurité : Si $REMOTE_DIR n'est pas défini dans la config, on utilise ton dossier par défaut
if (-not (Get-Variable -Name 'REMOTE_DIR' -ValueOnly -ErrorAction SilentlyContinue)) {
    $REMOTE_DIR = '/opt/www/xuehanyu_org'
}

$base = $PSScriptRoot

# ── Validate git repo ─────────────────────────────────────────────────────────

Push-Location $base

try {
    & git rev-parse --is-inside-work-tree *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "This script must run inside a git repository."
    }

    # ── Publish to GitHub first ───────────────────────────────────────────────

    Write-Host ""
    Write-Host "Publishing to GitHub..." -ForegroundColor Cyan

    & git add -A
    if ($LASTEXITCODE -ne 0) { throw "git add failed" }

    & git diff --cached --quiet
    $hasChanges = ($LASTEXITCODE -ne 0)

    if ($hasChanges) {
        $msg = "deploy $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

        & git commit -m $msg
        if ($LASTEXITCODE -ne 0) { throw "git commit failed" }

        & git push origin main
        if ($LASTEXITCODE -ne 0) { throw "git push failed" }

        Write-Host "Git publish complete: $msg" -ForegroundColor Green
    }
    else {
        Write-Host "No git changes to publish." -ForegroundColor Yellow
    }

    # ── Generate the static SEO pages (mot/, vocabulaire-hsk-N.html, sitemap-mots.xml) ──────────
    # Gitignored: rebuilt from data/ at every deploy.
    Write-Host ""
    Write-Host "Generating SEO pages..." -ForegroundColor Cyan
    & node (Join-Path $base 'scripts/build-seo.mjs')
    if ($LASTEXITCODE -ne 0) { throw "SEO page generation failed." }

    # ── Collect ALL physical files ────────────────────────────────────────────

    Write-Host ""
    Write-Host "Collecting all local files..." -ForegroundColor Cyan

    # Récupère tous les fichiers du dossier sans distinction de statut Git
    $allFiles = Get-ChildItem -Path $base -Recurse -File | ForEach-Object {
        # Transforme le chemin absolu en chemin relatif par rapport à la racine
        $_.FullName.Substring($base.Length + 1).Replace('\', '/')
    }

    if (-not $allFiles -or $allFiles.Count -eq 0) {
        throw "No local files found."
    }

    # ── Filter ONLY with .webignore ───────────────────────────────────────────

    $webIgnoreFile = Join-Path $base '.webignore'
    # On protège les outils de déploiement et les dossiers temporaires d'office
    $ignoredPatterns = @('deploy.ps1', 'deploy.config.ps1', '.webignore', '.gitignore', '.git', '.deploy_stage', '.deploy_stage.tgz', '.deploy_removed.txt')

    if (Test-Path $webIgnoreFile) {
        Write-Host "Applying .webignore filters..." -ForegroundColor Yellow
        $customIgnores = Get-Content $webIgnoreFile | ForEach-Object { $_.Trim() } | Where-Object { $_ -and -not $_.StartsWith('#') }
        foreach ($pattern in $customIgnores) {
            # Standardisation des slashes sous Windows/Linux
            $ignoredPatterns += $pattern.Replace('\', '/')
        }
    }

    $filesToDeploy = $allFiles | Where-Object {
        $file = $_
        $keep = $true
        foreach ($pattern in $ignoredPatterns) {
            $wildcard = $pattern
            # Si le pattern se termine par /, c'est un dossier entier à exclure
            if ($wildcard.EndsWith('/')) {
                $wildcard = "*$wildcard*"
            }
            else {
                if (-not $wildcard.StartsWith('*')) { $wildcard = "*$wildcard" }
                if (-not $wildcard.EndsWith('*')) { $wildcard = "$wildcard*" }
            }
            
            if ($file -like $wildcard) {
                $keep = $false
                break
            }
        }
        $keep
    }

    if (-not $filesToDeploy -or $filesToDeploy.Count -eq 0) {
        throw "No files left to deploy after filtering."
    }

    # ── Compare with what is already online (SHA-256, file by file) ───────────

    $REMOTE_NEW = "$REMOTE_DIR.new"
    $REMOTE_OLD = "$REMOTE_DIR.old"
    $sshArgs = @('-i', $SSH_KEY, '-o', 'StrictHostKeyChecking=accept-new', "$SSH_USER@$SSH_HOST")

    function Get-FileSha256([string]$path) {
        $sha = [System.Security.Cryptography.SHA256]::Create()
        $fs  = [System.IO.File]::OpenRead($path)
        try { return ([BitConverter]::ToString($sha.ComputeHash($fs)) -replace '-', '').ToLower() }
        finally { $fs.Dispose(); $sha.Dispose() }
    }

    Write-Host ""
    Write-Host "Comparing with the live site..." -ForegroundColor Cyan

    $remoteHashes = @{}
    if (-not $Full) {
        [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
        $listing = & ssh @sshArgs "cd '$REMOTE_DIR' 2>/dev/null && sudo find . -type f -exec sha256sum {} +"
        foreach ($line in $listing) {
            if ($line -match '^([0-9a-f]{64})  \./(.+)$') { $remoteHashes[$Matches[2]] = $Matches[1] }
        }
    }

    $changed = @()
    $localSet = @{}
    foreach ($file in $filesToDeploy) {
        $src = Join-Path $base $file
        if (-not (Test-Path $src)) { continue }
        $localSet[$file] = $true
        if ($remoteHashes[$file] -ne (Get-FileSha256 $src)) { $changed += $file }
    }
    $removed = @($remoteHashes.Keys | Where-Object { -not $localSet.ContainsKey($_) })

    $total = $localSet.Count
    Write-Host "$($changed.Count) file(s) to send, $($removed.Count) to delete, $($total - $changed.Count) unchanged (of $total)." -ForegroundColor White

    if ($changed.Count -eq 0 -and $removed.Count -eq 0 -and -not $Full) {
        Write-Host ""
        Write-Host "Nothing to deploy: the live site is already up to date." -ForegroundColor Green
        return
    }

    # ── Build staging directory (changed files only) ──────────────────────────

    $stage = Join-Path $base '.deploy_stage'
    Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Path $stage | Out-Null

    foreach ($file in $changed) {
        $dest    = Join-Path $stage $file
        $destDir = Split-Path $dest -Parent

        New-Item -ItemType Directory -Force -Path $destDir | Out-Null
        Copy-Item (Join-Path $base $file) $dest -Force
    }

    # ── Deploy to remote root ─────────────────────────────────────────────────

    Write-Host ""
    Write-Host "Deploying root site to $SSH_USER@$SSH_HOST..." -ForegroundColor Cyan

    # Deploiement ATOMIQUE : on prepare un dossier voisin (copie locale du site en ligne + fichiers
    # modifies), puis on l'echange avec le dossier en ligne. L'ancienne version videlait $REMOTE_DIR
    # avant de recopier : pendant ces secondes le site etait incomplet, et une requete arrivee a ce
    # moment recevait un 404 ou un fichier tronque que Cloudflare gardait ensuite en cache (jusqu'a 4 h).
    # La copie du site en ligne se fait sur le serveur (cp -a) : rien ne transite par le reseau.
    $prepare = if ($Full) { "sudo mkdir -p '$REMOTE_DIR' && sudo rm -rf '$REMOTE_NEW' '$REMOTE_OLD' && sudo mkdir -p '$REMOTE_NEW'" }
               else       { "sudo mkdir -p '$REMOTE_DIR' && sudo rm -rf '$REMOTE_NEW' '$REMOTE_OLD' && sudo cp -a '$REMOTE_DIR' '$REMOTE_NEW'" }
    & ssh @sshArgs $prepare
    if ($LASTEXITCODE -ne 0) { throw "SSH connection or remote copy failed." }

    if ($changed.Count -gt 0) {
        Write-Host "Uploading $($changed.Count) file(s) to $REMOTE_NEW (the live site is untouched)..." -ForegroundColor White

        # One compressed archive instead of thousands of individual scp transfers (the SEO pages are small files).
        $archive = Join-Path $base '.deploy_stage.tgz'
        & tar -czf $archive -C $stage .
        if ($LASTEXITCODE -ne 0) { throw "Archive creation failed." }

        & scp -i $SSH_KEY -o StrictHostKeyChecking=accept-new $archive "${SSH_USER}@${SSH_HOST}:/tmp/xuehanyu_deploy.tgz"
        if ($LASTEXITCODE -ne 0) { throw "SCP failed." }

        & ssh @sshArgs "sudo tar -xzf /tmp/xuehanyu_deploy.tgz -C '$REMOTE_NEW' && rm -f /tmp/xuehanyu_deploy.tgz"
        if ($LASTEXITCODE -ne 0) { throw "Remote extraction failed." }
    }

    if ($removed.Count -gt 0) {
        Write-Host "Deleting $($removed.Count) file(s) that no longer exist locally..." -ForegroundColor White
        # Liste ecrite en LF / UTF-8 sans BOM (PowerShell 5.1 ajouterait un BOM et du CRLF, qui casseraient les noms).
        $listFile = Join-Path $base '.deploy_removed.txt'
        [System.IO.File]::WriteAllText($listFile, (($removed -join "`n") + "`n"), (New-Object System.Text.UTF8Encoding($false)))
        & scp -i $SSH_KEY -o StrictHostKeyChecking=accept-new $listFile "${SSH_USER}@${SSH_HOST}:/tmp/xuehanyu_removed.txt"
        if ($LASTEXITCODE -ne 0) { throw "SCP of the deletion list failed." }
        & ssh @sshArgs "cd '$REMOTE_NEW' && sudo xargs -d '\n' rm -f < /tmp/xuehanyu_removed.txt && sudo find . -mindepth 1 -type d -empty -delete; rm -f /tmp/xuehanyu_removed.txt"
        if ($LASTEXITCODE -ne 0) { throw "Remote deletion failed." }
    }

    Write-Host "Fixing permissions, swapping the new version in and reloading Nginx..." -ForegroundColor White
    # chown/chcon --reference : le nouveau dossier prend le proprietaire et le contexte SELinux du dossier en ligne.
    & ssh @sshArgs "sudo chmod 755 '$REMOTE_NEW' && sudo find '$REMOTE_NEW' -type d -exec chmod 755 {} + && sudo find '$REMOTE_NEW' -type f -exec chmod 644 {} + && sudo chown --reference='$REMOTE_DIR' '$REMOTE_NEW' && (sudo chcon -R --reference='$REMOTE_DIR' '$REMOTE_NEW' || true) && sudo mv '$REMOTE_DIR' '$REMOTE_OLD' && sudo mv '$REMOTE_NEW' '$REMOTE_DIR' && sudo rm -rf '$REMOTE_OLD' && sudo nginx -s reload"
    if ($LASTEXITCODE -ne 0) { throw "Permission fix, swap or nginx reload failed." }

    Write-Host ""
    Write-Host "Deployment complete!" -ForegroundColor Green
}
catch {
    Write-Error $_
    exit 1
}
finally {
    Remove-Item (Join-Path $base '.deploy_stage') `
        -Recurse `
        -Force `
        -ErrorAction SilentlyContinue
    Remove-Item (Join-Path $base '.deploy_stage.tgz') -Force -ErrorAction SilentlyContinue
    Remove-Item (Join-Path $base '.deploy_removed.txt') -Force -ErrorAction SilentlyContinue

    Pop-Location
}