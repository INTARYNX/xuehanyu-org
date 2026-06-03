# Deploy the entire repository root to $REMOTE_DIR
# Excludes anything ignored by .gitignore and .webignore
# Also commits + pushes to Git before deploy

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

    # ── Collect tracked files (.gitignore filtered) ───────────────────────────

    Write-Host ""
    Write-Host "Collecting deployable files..." -ForegroundColor Cyan

    $gitFiles = (& git ls-files) | Where-Object { $_.Trim() -ne '' }

    if (-not $gitFiles -or $gitFiles.Count -eq 0) {
        throw "No tracked files found."
    }

    # ── Filter with .webignore ────────────────────────────────────────────────

    $webIgnoreFile = Join-Path $base '.webignore'
    $ignoredPatterns = @('deploy.ps1', 'deploy.config.ps1', '.webignore', '.gitignore')

    if (Test-Path $webIgnoreFile) {
        Write-Host "Applying .webignore filters..." -ForegroundColor Yellow
        $customIgnores = Get-Content $webIgnoreFile | ForEach-Object { $_.Trim() } | Where-Object { $_ -and -not $_.StartsWith('#') }
        $ignoredPatterns += $customIgnores
    }

    $filesToDeploy = $gitFiles | Where-Object {
        $file = $_
        $keep = $true
        foreach ($pattern in $ignoredPatterns) {
            $wildcard = $pattern
            if (-not $wildcard.StartsWith('*')) { $wildcard = "*$wildcard" }
            if (-not $wildcard.EndsWith('*')) { $wildcard = "$wildcard*" }
            
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

    # ── Build staging directory ───────────────────────────────────────────────

    $stage = Join-Path $base '.deploy_stage'
    Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Path $stage | Out-Null

    foreach ($file in $filesToDeploy) {
        $src = Join-Path $base $file
        if (-not (Test-Path $src)) { continue }

        $dest    = Join-Path $stage $file
        $destDir = Split-Path $dest -Parent

        New-Item -ItemType Directory -Force -Path $destDir | Out-Null
        Copy-Item $src $dest -Force
    }

    # ── Deploy to remote root ─────────────────────────────────────────────────

    Write-Host ""
    Write-Host "Deploying root site to $SSH_USER@$SSH_HOST..." -ForegroundColor Cyan

    & ssh `
        -i $SSH_KEY `
        -o StrictHostKeyChecking=accept-new `
        "$SSH_USER@$SSH_HOST" `
        "sudo mkdir -p '$REMOTE_DIR'"

    if ($LASTEXITCODE -ne 0) { throw "SSH connection failed." }

    Write-Host "Cleaning remote path: $REMOTE_DIR" -ForegroundColor White
    & ssh `
        -i $SSH_KEY `
        -o StrictHostKeyChecking=accept-new `
        "$SSH_USER@$SSH_HOST" `
        "sudo find '$REMOTE_DIR' -mindepth 1 -delete"

    if ($LASTEXITCODE -ne 0) { throw "Failed cleaning remote path: $REMOTE_DIR" }

    Write-Host "Uploading files..." -ForegroundColor White
    
    $remoteTarget = "${SSH_USER}@${SSH_HOST}:$REMOTE_DIR"

    & scp `
        -i $SSH_KEY `
        -o StrictHostKeyChecking=accept-new `
        -r `
        "$stage/*" `
        $remoteTarget

    if ($LASTEXITCODE -ne 0) { throw "SCP failed." }

    Write-Host "Fixing permissions and reloading Nginx..." -ForegroundColor White
    & ssh `
        -i $SSH_KEY `
        -o StrictHostKeyChecking=accept-new `
        "$SSH_USER@$SSH_HOST" `
        "sudo chmod 755 '$REMOTE_DIR' && sudo find '$REMOTE_DIR' -type d -exec chmod 755 {} + && sudo find '$REMOTE_DIR' -type f -exec chmod 644 {} + && sudo nginx -s reload"

    if ($LASTEXITCODE -ne 0) { throw "Permission fix or nginx reload failed." }

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

    Pop-Location
}