<# : Kukja Mario - double-click to view the site on this computer (Windows 10 / 11).
@echo off
rem Starts a small web server for the "site" folder with Windows PowerShell (built in, nothing
rem to install) and opens the browser. Close this window to stop the server.
title Kukja Mario
set "VA_SELF=%~f0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ([IO.File]::ReadAllText($env:VA_SELF))"
if errorlevel 1 pause
exit /b
#>
# ---- PowerShell part: a static file server on http://localhost:8080 (or the next free port)
$here = Split-Path -Parent $env:VA_SELF
$root = Join-Path $here 'site'
if (-not (Test-Path (Join-Path $root 'index.html'))) { $root = $here }      # the script sits inside the site folder
$root = [IO.Path]::GetFullPath($root).TrimEnd('\') + '\'
$types = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript'; '.mjs' = 'text/javascript'; '.css' = 'text/css'
  '.json' = 'application/json'; '.svg' = 'image/svg+xml'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.webp' = 'image/webp'
  '.ktx2' = 'image/ktx2'; '.glb' = 'model/gltf-binary'; '.bin' = 'application/octet-stream'; '.wasm' = 'application/wasm'
  '.woff2' = 'font/woff2'; '.txt' = 'text/plain; charset=utf-8'; '.md' = 'text/plain; charset=utf-8'
}
$listener = $null
foreach ($p in 8080..8099) {
  try { $l = New-Object System.Net.HttpListener; $l.Prefixes.Add("http://localhost:$p/"); $l.Start(); $listener = $l; $port = $p; break } catch { }
}
if (-not $listener) { Write-Host 'No free port between 8080 and 8099.'; exit 1 }
$url = "http://localhost:$port/"
Write-Host ''
Write-Host "  Kukja Mario is running at $url"
Write-Host '  Close this window to stop it.'
Write-Host ''
if (-not $env:VA_NO_BROWSER) { Start-Process $url }
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $res = $ctx.Response
  try {
    $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
    if ($path.EndsWith('/')) { $path += 'index.html' }
    $file = [IO.Path]::GetFullPath((Join-Path $root $path.TrimStart('/')))
    if ($file.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -and [IO.File]::Exists($file)) {
      $bytes = [IO.File]::ReadAllBytes($file)
      $ext = [IO.Path]::GetExtension($file).ToLower()
      $res.ContentType = $(if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' })
      $res.Headers.Add('Cache-Control', 'no-cache')
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $res.StatusCode = 404
    }
  } catch { } finally { try { $res.Close() } catch { } }
}
