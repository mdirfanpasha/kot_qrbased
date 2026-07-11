param(
    [Parameter(Mandatory=$true)]
    [string]$FilePath,

    [Parameter(Mandatory=$true)]
    [string]$PrinterName
)

Add-Type -AssemblyName System.Drawing

# Read the file as ASCII to avoid any encoding issues
$content = [System.IO.File]::ReadAllText($FilePath, [System.Text.Encoding]::ASCII)
$lines = $content -split "`r?`n"

$font  = New-Object System.Drawing.Font("Courier New", 9)
$brush = [System.Drawing.Brushes]::Black

# Shared counter for multi-page support
$script:lineIndex = 0

$pd = New-Object System.Drawing.Printing.PrintDocument
$pd.PrinterSettings.PrinterName = $PrinterName

$pd.add_PrintPage({
    param($sender, $e)
    $y          = [float]$e.MarginBounds.Top
    $lineHeight = $font.GetHeight($e.Graphics)

    while ($script:lineIndex -lt $lines.Count) {
        if (($y + $lineHeight) -gt $e.MarginBounds.Bottom) {
            $e.HasMorePages = $true
            return
        }
        $line = $lines[$script:lineIndex]
        $e.Graphics.DrawString($line, $font, $brush, [float]$e.MarginBounds.Left, $y)
        $y += $lineHeight
        $script:lineIndex++
    }
    $e.HasMorePages = $false
})

try {
    $pd.Print()
    Write-Host "Print job sent to: $PrinterName"
} finally {
    $pd.Dispose()
    $font.Dispose()
}
