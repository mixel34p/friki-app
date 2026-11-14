# Run from any directory: powershell -File scripts/generate-brand-icons.ps1
# Derive install/browser icons from the original mark, preserving both source PNGs.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;

public static class GeekSphereIcons {
    public static void Generate(string directory) {
        using (var source = new Bitmap(System.IO.Path.Combine(directory, "logo.png"))) {
            int left = source.Width, top = source.Height, right = 0, bottom = 0;
            for (int y = 0; y < source.Height; y++)
                for (int x = 0; x < source.Width; x++)
                    if (source.GetPixel(x, y).A > 8) {
                        left = Math.Min(left, x); top = Math.Min(top, y);
                        right = Math.Max(right, x); bottom = Math.Max(bottom, y);
                    }
            var bounds = Rectangle.FromLTRB(left, top, right + 1, bottom + 1);
            double radius = 0;
            for (int y = top; y <= bottom; y++)
                for (int x = left; x <= right; x++)
                    if (source.GetPixel(x, y).A > 8) {
                        double dx = x + .5 - (left + bounds.Width / 2.0);
                        double dy = y + .5 - (top + bounds.Height / 2.0);
                        radius = Math.Max(radius, Math.Sqrt(dx * dx + dy * dy));
                    }
            Write(source, bounds, radius, directory, "favicon-16.png", 16, .94, false, false);
            Write(source, bounds, radius, directory, "favicon-32.png", 32, .94, false, false);
            Write(source, bounds, radius, directory, "pwa-192.png", 192, .90, false, false);
            Write(source, bounds, radius, directory, "pwa-512.png", 512, .90, false, false);
            Write(source, bounds, radius, directory, "apple-touch-icon.png", 180, .82, true, false);
            Write(source, bounds, radius, directory, "pwa-maskable-512.png", 512, .90, true, true);
        }
    }
    private static void Write(Bitmap source, Rectangle bounds, double radius, string directory,
                              string name, int size, double coverage, bool opaque, bool maskable) {
        double scale = size * coverage / Math.Max(bounds.Width, bounds.Height);
        // Maskable artwork stays inside the central 80% safe circle, with a small margin.
        if (maskable) scale = Math.Min(scale, size * .38 / radius);
        float width = (float)(bounds.Width * scale), height = (float)(bounds.Height * scale);
        using (var icon = new Bitmap(size, size, PixelFormat.Format32bppArgb))
        using (var graphics = Graphics.FromImage(icon))
        using (var attributes = new ImageAttributes()) {
            graphics.Clear(opaque ? Color.FromArgb(7, 7, 9) : Color.Transparent);
            graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
            graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
            attributes.SetWrapMode(WrapMode.TileFlipXY);
            var target = Rectangle.Round(new RectangleF((size - width) / 2, (size - height) / 2, width, height));
            graphics.DrawImage(source, target, bounds.X, bounds.Y, bounds.Width, bounds.Height, GraphicsUnit.Pixel, attributes);
            icon.Save(System.IO.Path.Combine(directory, name), ImageFormat.Png);
        }
    }
}
'@
[GeekSphereIcons]::Generate((Join-Path (Split-Path $PSScriptRoot -Parent) 'public/icons'))
