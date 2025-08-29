# Icon Files

The following icon files need to be created for platform-specific builds:

- `public/icon.icns` - macOS icon (512x512, can be created from PNG using iconutil)
- `public/icon.ico` - Windows icon (multiple sizes: 16x16, 32x32, 48x48, 256x256)  
- `public/icon.png` - Linux icon (512x512 PNG)

For now, the build will use the favicon.ico as a fallback, but proper icons should be created for production releases.

To create the icons:
1. Start with a 512x512 PNG file
2. Use online tools or iconutil (macOS) to convert to the required formats
3. Place the files in the public directory

The glassmorphic logo design should be used as the basis for these icons.
