# Installs / updates the daily-reminder service (server/) on the server.
# Idempotent. Copies server/ to /tmp, runs server/install.sh as root:
#   - /opt/xuehanyu_push (code + venv), systemd unit xuehanyu-push.service (127.0.0.1:3004)
#   - patches /etc/nginx/conf.d/xuehanyu_org.conf (backup first, `nginx -t`, automatic restore on failure)
# Uses the same SSH target as deploy.ps1 (deploy.config.ps1).

$ErrorActionPreference = 'Stop'
$base = Split-Path $PSScriptRoot -Parent
. (Join-Path $base 'deploy.config.ps1')

$remote = "$SSH_USER@$SSH_HOST"
$sshOpts = @('-i', $SSH_KEY, '-o', 'StrictHostKeyChecking=accept-new')

# Force LF: a CRLF shebang or heredoc breaks bash on the server.
$stage = Join-Path ([IO.Path]::GetTempPath()) ('xuehanyu_push_' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage | Out-Null
try {
    foreach ($f in 'push_server.py', 'requirements.txt', 'xuehanyu-push.service', 'patch_nginx.py', 'install.sh') {
        $text = [IO.File]::ReadAllText((Join-Path $base "server/$f")).Replace("`r`n", "`n")
        [IO.File]::WriteAllText((Join-Path $stage $f), $text, (New-Object Text.UTF8Encoding $false))
    }

    & ssh @sshOpts $remote 'rm -rf /tmp/xuehanyu_push_upload && mkdir -p /tmp/xuehanyu_push_upload'
    if ($LASTEXITCODE -ne 0) { throw 'SSH connection failed.' }
    & scp @sshOpts -r "$stage/." "${remote}:/tmp/xuehanyu_push_upload/"
    if ($LASTEXITCODE -ne 0) { throw 'SCP failed.' }
    & ssh @sshOpts $remote 'sudo bash /tmp/xuehanyu_push_upload/install.sh; rc=$?; rm -rf /tmp/xuehanyu_push_upload; exit $rc'
    if ($LASTEXITCODE -ne 0) { throw 'Remote install failed (see output above).' }
    Write-Host 'Reminder service installed.' -ForegroundColor Green
}
finally {
    Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
}
