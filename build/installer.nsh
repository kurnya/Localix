!macro customInit
  ${IfNot} ${isUpdated}
    StrCpy $INSTDIR "C:\localix"
  ${EndIf}
!macroend

!macro moveToAppBin FILE_NAME
  ${If} ${FileExists} "$INSTDIR\${FILE_NAME}"
    Delete "$INSTDIR\app-bin\${FILE_NAME}"
    Rename "$INSTDIR\${FILE_NAME}" "$INSTDIR\app-bin\${FILE_NAME}"
  ${EndIf}
!macroend

!macro moveFolderToAppBin FOLDER_NAME
  ${If} ${FileExists} "$INSTDIR\${FOLDER_NAME}"
    RMDir /r "$INSTDIR\app-bin\${FOLDER_NAME}"
    Rename "$INSTDIR\${FOLDER_NAME}" "$INSTDIR\app-bin\${FOLDER_NAME}"
  ${EndIf}
!macroend

!macro moveResourceFolder FOLDER_NAME
  ${If} ${FileExists} "$INSTDIR\app-bin\resources\${FOLDER_NAME}"
    ${IfNot} ${FileExists} "$INSTDIR\${FOLDER_NAME}"
      Rename "$INSTDIR\app-bin\resources\${FOLDER_NAME}" "$INSTDIR\${FOLDER_NAME}"
    ${EndIf}
  ${EndIf}
!macroend

!macro customInstall
  CreateDirectory "$INSTDIR\app-bin"

  !insertmacro moveToAppBin "${APP_EXECUTABLE_FILENAME}"
  !insertmacro moveFolderToAppBin "resources"
  !insertmacro moveFolderToAppBin "locales"

  CopyFiles /SILENT "$INSTDIR\*.dll" "$INSTDIR\app-bin\"
  Delete "$INSTDIR\*.dll"
  CopyFiles /SILENT "$INSTDIR\*.pak" "$INSTDIR\app-bin\"
  Delete "$INSTDIR\*.pak"
  CopyFiles /SILENT "$INSTDIR\*.bin" "$INSTDIR\app-bin\"
  Delete "$INSTDIR\*.bin"
  CopyFiles /SILENT "$INSTDIR\*.dat" "$INSTDIR\app-bin\"
  Delete "$INSTDIR\*.dat"
  CopyFiles /SILENT "$INSTDIR\LICENSE*" "$INSTDIR\app-bin\"
  Delete "$INSTDIR\LICENSE*"
  CopyFiles /SILENT "$INSTDIR\chrome_crashpad_handler.exe" "$INSTDIR\app-bin\"
  Delete "$INSTDIR\chrome_crashpad_handler.exe"

  !insertmacro moveResourceFolder "runtime"
  !insertmacro moveResourceFolder "config"
  !insertmacro moveResourceFolder "www"

  StrCpy $appExe "$INSTDIR\app-bin\${APP_EXECUTABLE_FILENAME}"
  StrCpy $launchLink "$appExe"

  ${If} ${FileExists} "$newStartMenuLink"
    Delete "$newStartMenuLink"
    CreateShortCut "$newStartMenuLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
    WinShell::SetLnkAUMI "$newStartMenuLink" "${APP_ID}"
  ${EndIf}

  ${If} ${FileExists} "$newDesktopLink"
    Delete "$newDesktopLink"
    CreateShortCut "$newDesktopLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
    WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
  ${EndIf}
!macroend
