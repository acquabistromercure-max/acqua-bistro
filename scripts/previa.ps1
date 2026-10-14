# Servidor local de PRÉVIAS (pasta .preview, fora do git) — só nesta máquina: http://localhost:8091
param([int]$Port = 8091)
$root = Join-Path (Split-Path $PSScriptRoot) '.preview'
$types = @{ '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'; '.svg' = 'image/svg+xml'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.woff2' = 'font/woff2'; '.ico' = 'image/x-icon'; '.json' = 'application/json' }
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Prévias do Acqua Bistrô em http://localhost:$Port  (Ctrl+C para parar)"
try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if (-not $path) { $path = 'index.html' }
    $file = [IO.Path]::GetFullPath((Join-Path $root $path))
    $res = $ctx.Response
    $res.Headers.Add('X-Content-Type-Options', 'nosniff')
    $res.Headers.Add('X-Frame-Options', 'DENY')
    $res.Headers.Add('Referrer-Policy', 'no-referrer')
    $res.Headers.Add('Cache-Control', 'no-store')
    try {
      if ($file.StartsWith($root) -and (Test-Path $file -PathType Leaf) -and $types.ContainsKey([IO.Path]::GetExtension($file))) {
        $bytes = [IO.File]::ReadAllBytes($file)
        $res.ContentType = $types[[IO.Path]::GetExtension($file)]
        $res.ContentLength64 = $bytes.Length
        # HEAD: só os cabeçalhos, sem corpo
        if ($ctx.Request.HttpMethod -ne 'HEAD') { $res.OutputStream.Write($bytes, 0, $bytes.Length) }
      } else { $res.StatusCode = 404 }
    } catch { Write-Host "Falha ao responder $path : $($_.Exception.Message)" }
    try { $res.Close() } catch { }
  }
} finally { $listener.Stop() }

