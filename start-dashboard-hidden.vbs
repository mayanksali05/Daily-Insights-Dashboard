' Runs start-dashboard.bat with no console window.
' Put a shortcut to this file in your Startup folder (Win+R -> shell:startup)
' so the dashboard starts automatically when you log in.
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
here = fso.GetParentFolderName(WScript.ScriptFullName)
shell.Run """" & here & "\start-dashboard.bat""", 0, False
