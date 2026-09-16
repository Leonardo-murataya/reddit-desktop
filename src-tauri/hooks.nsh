!macro NSIS_HOOK_PREINSTALL
  DetailPrint "Cerrando instancias previas de Reddit Video Generator para actualizar en caliente..."
  nsExec::Exec 'cmd /c "powershell -NoProfile -Command \"Get-NetTCPConnection -LocalPort 31826 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }\" >nul 2>&1"'
  nsExec::Exec 'cmd /c "taskkill /F /IM app.exe /T >nul 2>&1"'
  nsExec::Exec 'cmd /c "taskkill /F /IM \"Reddit Video Generator.exe\" /T >nul 2>&1"'
  Sleep 1000
!macroend
