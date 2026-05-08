@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 雷電.蒼穹突擊 - Local Server (port 8000)

echo.
echo ============================================
echo   雷電.蒼穹突擊 — 本機伺服器
echo   http://localhost:8000
echo   按 Ctrl+C 停止
echo ============================================
echo.

where python >nul 2>&1
if not errorlevel 1 (
    start "" http://localhost:8000
    python -m http.server 8000
    goto :end
)

where py >nul 2>&1
if not errorlevel 1 (
    start "" http://localhost:8000
    py -3 -m http.server 8000
    goto :end
)

echo [警告] 找不到 Python，改用 PowerShell HttpListener fallback...
echo.
start "" http://localhost:8000
powershell -NoProfile -ExecutionPolicy Bypass -Command "$root=(Get-Location).Path; $l=New-Object System.Net.HttpListener; $l.Prefixes.Add('http://localhost:8000/'); try { $l.Start() } catch { Write-Host '[錯誤] 無法綁定 port 8000，可能已被占用'; exit 1 }; Write-Host '[OK] PS server running. Ctrl+C 停止.'; $mimes=@{'.html'='text/html;charset=utf-8';'.js'='application/javascript';'.css'='text/css';'.json'='application/json';'.png'='image/png';'.webmanifest'='application/manifest+json';'.ico'='image/x-icon';'.svg'='image/svg+xml'}; while($l.IsListening){ try { $c=$l.GetContext(); $p=$c.Request.Url.LocalPath; if($p -eq '/'){ $p='/index.html' }; $f=Join-Path $root $p.TrimStart('/'); if(Test-Path $f -PathType Leaf){ $ext=[IO.Path]::GetExtension($f).ToLower(); $mime=$mimes[$ext]; if(-not $mime){ $mime='application/octet-stream' }; $b=[IO.File]::ReadAllBytes($f); $c.Response.ContentType=$mime; $c.Response.OutputStream.Write($b,0,$b.Length) } else { $c.Response.StatusCode=404 }; $c.Response.Close() } catch {} }"

:end
endlocal
