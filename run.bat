@echo off
setlocal
cd /d "%~dp0"
title Thunder Force PWA - http://localhost:8000

echo.
echo ============================================
echo  Thunder Force PWA  -  Local Server
echo  URL : http://localhost:8000
echo  Stop: Ctrl+C
echo ============================================
echo.

set "PORT=8000"
set "URL=http://localhost:%PORT%"

where python >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] Using Python at:
    where python
    echo.
    start "" "%URL%"
    python -m http.server %PORT%
    goto :end
)

where py >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] Using py launcher
    echo.
    start "" "%URL%"
    py -3 -m http.server %PORT%
    goto :end
)

echo [WARN] Python not found - falling back to PowerShell HttpListener
echo.
start "" "%URL%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$root=(Get-Location).Path; $l=New-Object System.Net.HttpListener; $l.Prefixes.Add('http://localhost:%PORT%/'); try { $l.Start() } catch { Write-Host '[ERROR] Cannot bind port %PORT% - probably in use'; exit 1 }; Write-Host '[OK] PS server running. Ctrl+C to stop.'; $mimes=@{'.html'='text/html;charset=utf-8';'.js'='application/javascript';'.css'='text/css';'.json'='application/json';'.png'='image/png';'.webmanifest'='application/manifest+json';'.ico'='image/x-icon';'.svg'='image/svg+xml'}; while($l.IsListening){ try { $c=$l.GetContext(); $p=$c.Request.Url.LocalPath; if($p -eq '/'){ $p='/index.html' }; $f=Join-Path $root $p.TrimStart('/'); if(Test-Path $f -PathType Leaf){ $ext=[IO.Path]::GetExtension($f).ToLower(); $mime=$mimes[$ext]; if(-not $mime){ $mime='application/octet-stream' }; $b=[IO.File]::ReadAllBytes($f); $c.Response.ContentType=$mime; $c.Response.OutputStream.Write($b,0,$b.Length) } else { $c.Response.StatusCode=404 }; $c.Response.Close() } catch {} }"

:end
endlocal
