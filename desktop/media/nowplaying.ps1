# Now playing helper for the desktop widget (Windows 10 1809+).
# Reads what's playing from Windows' media session (the same info as the volume-key media flyout),
# so it works for YouTube Music in any browser, Spotify, etc.
#   stdout: one JSON object per line   {"type":"state",...} | {"type":"art",...} | {"type":"unsupported"} | {"type":"error"}
#   stdin:  one command per line       toggle | next | previous
# Runs in Windows PowerShell 5.1 (built into Windows), which can call WinRT APIs.
# Troubleshooting: run with -Diag to print one snapshot (including why album art failed) and exit.
param([switch]$Diag)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false

function Send($obj) {
  [Console]::Out.WriteLine(($obj | ConvertTo-Json -Compress -Depth 3))
  [Console]::Out.Flush()
}

try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
  $null = [Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType = WindowsRuntime]
  $AsTaskOp = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
  } | Select-Object -First 1
} catch {
  Send @{ type = 'unsupported'; message = "$_" }
  exit 0
}
try {
  # Used to read album art without .NET stream conversions.
  $null = [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]
  $null = [Windows.Security.Cryptography.CryptographicBuffer, Windows.Security.Cryptography, ContentType = WindowsRuntime]
} catch { }

# Waits for a WinRT async operation and returns its result.
function Await($op, [Type]$resultType) {
  $task = $AsTaskOp.MakeGenericMethod($resultType).Invoke($null, @($op))
  if (-not $task.Wait(5000)) { throw 'Windows media request timed out' }
  $task.Result
}

$ManagerType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]
$PropsType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties]
$StreamType = [Windows.Storage.Streams.IRandomAccessStreamWithContentType]

try {
  $Manager = Await ($ManagerType::RequestAsync()) $ManagerType
} catch {
  Send @{ type = 'unsupported'; message = "$_" }
  exit 0
}

# The session Windows shows in its flyout; otherwise any session that is playing.
function Get-Session {
  $s = $Manager.GetCurrentSession()
  if ($s) { return $s }
  foreach ($x in $Manager.GetSessions()) {
    if ("$($x.GetPlaybackInfo().PlaybackStatus)" -eq 'Playing') { return $x }
  }
  return $null
}

# Album art as a data: URL, or $null. $script:ArtError says why when it fails.
$script:ArtError = ''
function Get-Art($props) {
  $script:ArtError = ''
  if (-not $props.Thumbnail) { $script:ArtError = 'player gave no thumbnail'; return $null }
  $ras = Await ($props.Thumbnail.OpenReadAsync()) $StreamType
  try {
    $ct = "$($ras.ContentType)"
    if ($ct -notmatch '^image/[a-z+.-]+$') { $ct = 'image/jpeg' }
    $size = [uint64]$ras.Size
    if ($size -gt 2MB) { $script:ArtError = "thumbnail too big ($size bytes)"; return $null }
    $b64 = $null
    $errs = @()
    # 1) WinRT DataReader -> base64 (no .NET stream conversion needed)
    if ($size -gt 0) {
      try {
        $reader = [Windows.Storage.Streams.DataReader]::new($ras.GetInputStreamAt(0))
        $loaded = Await ($reader.LoadAsync([uint32]$size)) ([uint32])
        if ($loaded -gt 0) {
          $buf = $reader.ReadBuffer($loaded)
          $b64 = [Windows.Security.Cryptography.CryptographicBuffer]::EncodeToBase64String($buf)
        }
        $reader.Dispose()
      } catch { $errs += "DataReader: $_" }
    }
    # 2) .NET stream copy (also works when the stream doesn't report its size)
    if (-not $b64) {
      try {
        $ras.Seek(0)
        $src = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead([Windows.Storage.Streams.IInputStream]$ras)
        $ms = New-Object System.IO.MemoryStream
        $src.CopyTo($ms)
        if ($ms.Length -gt 0 -and $ms.Length -le 2MB) { $b64 = [Convert]::ToBase64String($ms.ToArray()) }
      } catch { $errs += "Stream: $_" }
    }
    if (-not $b64) {
      $script:ArtError = if ($errs) { $errs -join ' | ' } else { "empty thumbnail (size $size)" }
      return $null
    }
    return "data:$ct;base64,$b64"
  } finally {
    $ras.Dispose()
  }
}

if ($Diag) {
  $s = Get-Session
  if (-not $s) { Write-Output 'No media session. Start playing something first.'; exit 0 }
  $p = Await ($s.TryGetMediaPropertiesAsync()) $PropsType
  Write-Output "App:       $($s.SourceAppUserModelId)"
  Write-Output "Title:     $($p.Title)"
  Write-Output "Artist:    $($p.Artist)"
  Write-Output "Status:    $($s.GetPlaybackInfo().PlaybackStatus)"
  Write-Output "Thumbnail: $([bool]$p.Thumbnail)"
  $url = $null
  try { $url = Get-Art $p } catch { $script:ArtError = "$_" }
  if ($url) { Write-Output ("Art:       OK, " + $url.Substring(0, $url.IndexOf(',')) + ", $([int]($url.Length * 3 / 4 / 1024)) KB") }
  else { Write-Output "Art:       FAILED - $($script:ArtError)" }
  exit 0
}

$stdin = New-Object System.IO.StreamReader ([Console]::OpenStandardInput())
$pending = $stdin.ReadLineAsync()
$lastJson = ''
$artKey = $null     # track whose art was sent
$artTries = 0       # players often attach the art a moment after the title
$artSent = $false
$errors = 0

while ($true) {
  # Commands from the widget (arrive on stdin; the wait below wakes up as soon as one does).
  if ($pending.IsCompleted) {
    $cmd = $pending.Result
    if ($null -eq $cmd) { break }   # stdin closed: the widget has quit
    try {
      $s = Get-Session
      if ($s) {
        switch ($cmd.Trim()) {
          'toggle'   { $null = Await ($s.TryTogglePlayPauseAsync()) ([bool]) }
          'next'     { $null = Await ($s.TrySkipNextAsync()) ([bool]) }
          'previous' { $null = Await ($s.TrySkipPreviousAsync()) ([bool]) }
        }
      }
    } catch { }
    $pending = $stdin.ReadLineAsync()
    Start-Sleep -Milliseconds 150   # let the player update before reading it again
  }

  try {
    $s = Get-Session
    if (-not $s) {
      $state = @{ type = 'state'; active = $false }
    } else {
      $p = Await ($s.TryGetMediaPropertiesAsync()) $PropsType
      $info = $s.GetPlaybackInfo()
      $t = $s.GetTimelineProperties()
      $key = "$($s.SourceAppUserModelId)|$($p.Title)|$($p.Artist)"
      $state = [ordered]@{
        type      = 'state'
        active    = [bool]$p.Title
        app       = "$($s.SourceAppUserModelId)"
        title     = "$($p.Title)"
        artist    = "$($p.Artist)"
        album     = "$($p.AlbumTitle)"
        status    = "$($info.PlaybackStatus)"
        canToggle = [bool]$info.Controls.IsPlayPauseToggleEnabled
        canNext   = [bool]$info.Controls.IsNextEnabled
        canPrev   = [bool]$info.Controls.IsPreviousEnabled
        position  = [math]::Round($t.Position.TotalSeconds, 1)
        duration  = [math]::Round(($t.EndTime - $t.StartTime).TotalSeconds, 1)
        updated   = $t.LastUpdatedTime.ToUnixTimeMilliseconds()
        artKey    = $key
      }
      if ($key -ne $artKey) { $artKey = $key; $artTries = 0; $artSent = $false }
      # Browsers often attach the art a few seconds after the title, so keep trying for ~20 s.
      if (-not $artSent -and $artTries -lt 20) {
        $artTries++
        $url = $null
        try { $url = Get-Art $p } catch { $script:ArtError = "$_" }
        if ($url) { Send @{ type = 'art'; key = $key; url = $url }; $artSent = $true }
        elseif ($artTries -eq 20) { Send @{ type = 'art'; key = $key; url = $null; error = $script:ArtError } }
      }
    }
    $json = $state | ConvertTo-Json -Compress -Depth 3
    if ($json -ne $lastJson) {
      [Console]::Out.WriteLine($json)
      [Console]::Out.Flush()
      $lastJson = $json
    }
    $errors = 0
  } catch {
    $errors++
    if ($errors -eq 1) { Send @{ type = 'error'; message = "$_" } }
  }

  $null = $pending.Wait(1000)
}
