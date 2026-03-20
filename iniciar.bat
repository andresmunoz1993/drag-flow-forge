@echo off
title Allers — Iniciando sistema...
color 0A

echo.
echo  ==========================================
echo    ALLERS — Iniciando Frontend y Backend
echo  ==========================================
echo.

:: ── Backend ────────────────────────────────────────────────────
echo  [1/3] Iniciando Backend  (puerto 3001)...
start "Allers BACKEND" cmd /k "color 0B && title Allers BACKEND && cd /d C:\Proyectos\Sistema_Gestion_Kanban\drag-flow-forge\backend && npm run dev"

:: Esperar 3 segundos para que el backend arranque primero
timeout /t 3 /nobreak > nul

:: ── Frontend ───────────────────────────────────────────────────
echo  [2/3] Iniciando Frontend (puerto 8080)...
start "Allers FRONTEND" cmd /k "color 0E && title Allers FRONTEND && cd /d C:\Proyectos\Sistema_Gestion_Kanban\drag-flow-forge && npm run dev"

:: Esperar que Vite compile antes de abrir el navegador
echo  [3/3] Esperando que los servidores levanten...
timeout /t 6 /nobreak > nul

:: ── Navegador ──────────────────────────────────────────────────
echo  Abriendo http://localhost:8080 ...
start http://localhost:8080

echo.
echo  Listo. Cierra esta ventana cuando quieras.
echo  Para detener: cierra las ventanas BACKEND y FRONTEND.
echo.
pause
