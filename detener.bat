@echo off
title Allers — Deteniendo servidores...
color 0C

echo.
echo  ==========================================
echo    ALLERS — Deteniendo Frontend y Backend
echo  ==========================================
echo.

:: Cerrar las ventanas por su título
echo  Cerrando ventana BACKEND...
taskkill /FI "WINDOWTITLE eq Allers BACKEND*" /T /F > nul 2>&1

echo  Cerrando ventana FRONTEND...
taskkill /FI "WINDOWTITLE eq Allers FRONTEND*" /T /F > nul 2>&1

echo.
echo  Servidores detenidos.
echo.
timeout /t 2 /nobreak > nul
