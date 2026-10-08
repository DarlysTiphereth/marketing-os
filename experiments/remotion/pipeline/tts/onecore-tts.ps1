# Local, offline TTS via Windows OneCore voices (WinRT). Emits WAV + word-boundary JSON.
# Usage: powershell -File onecore-tts.ps1 -Voice "Daniel" -Ssml <file.ssml> -OutWav <file.wav> -OutJson <file.json>
param([string]$Voice, [string]$Ssml, [string]$OutWav, [string]$OutJson)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
function Await($op, [Type]$t) { $task = $asTask.MakeGenericMethod($t).Invoke($null, @($op)); $task.Wait(); $task.Result }
$synth = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
$v = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.DisplayName -like "*$Voice*" -and $_.Language -eq 'pt-BR' } | Select-Object -First 1
if (-not $v) { throw "Voice $Voice pt-BR not found" }
$synth.Voice = $v
$synth.Options.IncludeWordBoundaryMetadata = $true
$text = [IO.File]::ReadAllText($Ssml, [Text.Encoding]::UTF8)
$stream = Await ($synth.SynthesizeSsmlToStreamAsync($text)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
$words = @()
foreach ($track in $stream.TimedMetadataTracks) { foreach ($cue in $track.Cues) { $words += [pscustomobject]@{ text = $cue.Text; start_ms = [math]::Round($cue.StartTime.TotalMilliseconds, 1); dur_ms = [math]::Round($cue.Duration.TotalMilliseconds, 1) } } }
$size = [uint32]$stream.Size
$reader = New-Object Windows.Storage.Streams.DataReader($stream.GetInputStreamAt(0))
$null = Await ($reader.LoadAsync($size)) ([uint32])
$bytes = New-Object byte[] $size
$reader.ReadBytes($bytes)
[IO.File]::WriteAllBytes($OutWav, $bytes)
$meta = [pscustomobject]@{ voice = $v.DisplayName; voice_id = $v.Id; language = $v.Language; gender = "$($v.Gender)"; words = $words }
[IO.File]::WriteAllText($OutJson, ($meta | ConvertTo-Json -Depth 5), (New-Object Text.UTF8Encoding($false)))
