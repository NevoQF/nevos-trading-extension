# Windows fallback when Git runs hooks via PowerShell.
param([string]$MsgFile = $args[0])
if (-not $MsgFile -or -not (Test-Path -LiteralPath $MsgFile)) { exit 0 }
$lines = Get-Content -LiteralPath $MsgFile | Where-Object {
  $_ -notmatch '^Co-authored-by:\s*(Cursor|cursoragent)'
}
Set-Content -LiteralPath $MsgFile -Value $lines -NoNewline:$false
exit 0
