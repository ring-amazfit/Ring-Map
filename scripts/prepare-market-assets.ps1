param(
  [string]$Root = (Split-Path -Parent $PSScriptRoot)
)

Add-Type -AssemblyName System.Drawing

$market = Join-Path $Root 'docs\market-assets'
New-Item -ItemType Directory -Force -Path $market | Out-Null

function Save-ScaledPng {
  param(
    [string]$Source,
    [string]$Destination,
    [int]$Width,
    [int]$Height
  )

  $image = [System.Drawing.Image]::FromFile($Source)
  try {
    $canvas = New-Object System.Drawing.Bitmap($Width, $Height)
    try {
      $canvas.SetResolution(96, 96)
      $graphics = [System.Drawing.Graphics]::FromImage($canvas)
      try {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        try {
          # Zepp market screenshots are square PNGs with the circular watch UI
          # touching the top and bottom, while the four outer corners stay transparent.
          $path.AddEllipse(0, 0, $Width, $Height)
          $graphics.SetClip($path)
          $graphics.DrawImage($image, 0, 0, $Width, $Height)
        } finally {
          $path.Dispose()
        }
        $canvas.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Png)
      } finally {
        $graphics.Dispose()
      }
    } finally {
      $canvas.Dispose()
    }
  } finally {
    $image.Dispose()
  }
}

Save-ScaledPng (Join-Path $Root 'assets\balance\icon.png') (Join-Path $market 'store-icon-240.png') 240 240
Save-ScaledPng (Join-Path $Root 'docs\images\watch-left-turn.jpg') (Join-Path $market 'screen-navigation-turn-360.png') 360 360
Save-ScaledPng (Join-Path $Root 'docs\images\watch-waiting.jpg') (Join-Path $market 'screen-navigation-waiting-360.png') 360 360
Save-ScaledPng (Join-Path $Root 'docs\images\watch-navigation-preview.png') (Join-Path $market 'screen-navigation-theme-360.png') 360 360
Save-ScaledPng (Join-Path $Root 'docs\images\watch-settings-preview.png') (Join-Path $market 'screen-settings-360.png') 360 360
Save-ScaledPng (Join-Path $Root 'docs\images\watch-about-preview.png') (Join-Path $market 'screen-about-360.png') 360 360

Get-ChildItem -Path $market -Filter '*.png' | ForEach-Object {
  $image = [System.Drawing.Image]::FromFile($_.FullName)
  try {
    if ($image.Width -ne 360 -and $_.Name -ne 'store-icon-240.png') {
      throw "Unexpected market screenshot width: $($_.Name)"
    }
    if ($image.Width -eq 360 -and $image.Height -ne 360) {
      throw "Unexpected market screenshot height: $($_.Name)"
    }
    if ($_.Name -eq 'store-icon-240.png' -and ($image.Width -ne 240 -or $image.Height -ne 240)) {
      throw 'Unexpected market icon dimensions'
    }
  } finally {
    $image.Dispose()
  }
}

Write-Output "Prepared ZeppOS market assets in $market"
