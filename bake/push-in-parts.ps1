# Push the project to GitHub in five smaller steps (one 62 MB push kept getting cut off).
# The last commit has exactly the same files as the original single commit.
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
git config --unset http.lowSpeedLimit
git config --unset http.lowSpeedTime
$steps = @(
  @('2cc136efd1838a427c875cd809d0c2a3e775c063', 'code, plan data, tools, docs'),
  @('efa4ac7fec98ae90c9fc46a2edc73220279cd335', 'three.js and decoders'),
  @('cd01f71b849562e1bde1c6ed68b36d79eb5a6723', 'textures'),
  @('3ae2518ea27ac98842a8a02ff396c8c02b8fb1f0', 'baked lightmaps'),
  @('421bf3a9b2688041299c39df9cd4f4b273c8da1a', 'baked models')
)
$i = 0
foreach ($s in $steps) {
  $i++
  Write-Host "`n[$i/5] $($s[1])"
  $ok = $false
  for ($try = 1; $try -le 3 -and -not $ok; $try++) {
    git push origin "$($s[0]):refs/heads/master"
    if ($LASTEXITCODE -eq 0) { $ok = $true } else { Write-Host "  retry $try failed, trying again"; Start-Sleep 3 }
  }
  if (-not $ok) { Write-Host "STOPPED at step $i"; exit 1 }
}
# local master now points at the pushed history (same files as before)
git update-ref refs/heads/master 421bf3a9b2688041299c39df9cd4f4b273c8da1a
git branch --set-upstream-to=origin/master master
git fetch origin
git status -sb
Write-Host "`nALL PUSHED"
