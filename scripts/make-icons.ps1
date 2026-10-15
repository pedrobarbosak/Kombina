# Regenerates icons/icon-*.png: a warm-orange rounded square with a white shopping basket and a check mark.
# Usage: powershell -ExecutionPolicy Bypass -File scripts/make-icons.ps1
Add-Type -AssemblyName System.Drawing

$outDir = Join-Path $PSScriptRoot '..\icons'
New-Item -ItemType Directory -Force $outDir | Out-Null

$orange = [System.Drawing.Color]::FromArgb(217, 119, 43)
$white = [System.Drawing.Color]::White

function RoundedRect([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

foreach ($size in 16, 32, 48, 128) {
  # Draw at 4x and downscale for clean edges at small sizes.
  $scale = 4
  $S = $size * $scale
  $bmp = New-Object System.Drawing.Bitmap $S, $S
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::Transparent)

  # Background
  $g.FillPath((New-Object System.Drawing.SolidBrush $orange), (RoundedRect 0 0 $S $S ($S * 0.22)))

  $u = $S / 100.0   # 100-unit design grid
  $stroke = [Math]::Max(6 * $u, 1)
  $pen = New-Object System.Drawing.Pen $white, $stroke
  $pen.StartCap = 'Round'; $pen.EndCap = 'Round'; $pen.LineJoin = 'Round'

  # Basket body: trapezoid, slightly narrower at the bottom, rounded corners
  $body = New-Object System.Drawing.Drawing2D.GraphicsPath
  $body.AddPolygon([System.Drawing.PointF[]]@(
    (New-Object System.Drawing.PointF (16 * $u), (42 * $u)),
    (New-Object System.Drawing.PointF (84 * $u), (42 * $u)),
    (New-Object System.Drawing.PointF (74 * $u), (82 * $u)),
    (New-Object System.Drawing.PointF (26 * $u), (82 * $u))
  ))
  $g.FillPath((New-Object System.Drawing.SolidBrush $white), $body)
  $g.DrawPath($pen, $body)

  # Handle: an arc above the rim
  $g.DrawArc($pen, (30 * $u), (18 * $u), (40 * $u), (44 * $u), 200, 140)

  if ($size -ge 32) {
    # Check mark inside the basket, in the background colour
    $check = New-Object System.Drawing.Pen $orange, ($stroke * 1.4)
    $check.StartCap = 'Round'; $check.EndCap = 'Round'; $check.LineJoin = 'Round'
    $g.DrawLines($check, [System.Drawing.PointF[]]@(
      (New-Object System.Drawing.PointF (36 * $u), (62 * $u)),
      (New-Object System.Drawing.PointF (46 * $u), (72 * $u)),
      (New-Object System.Drawing.PointF (64 * $u), (52 * $u))
    ))
  }

  $out = New-Object System.Drawing.Bitmap $size, $size
  $g2 = [System.Drawing.Graphics]::FromImage($out)
  $g2.InterpolationMode = 'HighQualityBicubic'
  $g2.SmoothingMode = 'AntiAlias'
  $g2.PixelOffsetMode = 'HighQuality'
  $g2.DrawImage($bmp, 0, 0, $size, $size)
  $out.Save((Join-Path $outDir "icon-$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $g2.Dispose(); $out.Dispose(); $g.Dispose(); $bmp.Dispose()
}
Write-Output "Icons written to $outDir"
