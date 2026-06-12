# Upload fixes - 2026-06-12

## Summary

- Fixed the uploaded file link row in the admin uploader so the copy button aligns with the displayed URL field.
- Preserved Chinese filenames during R2 uploads by decoding multipart filenames before sanitizing unsafe path characters.
- Encoded public R2 URLs for browser-safe access while keeping the returned filename and object path readable.
- Displayed decoded URLs in the admin uploader so Chinese filenames are readable, while copy still uses the real URL.

## Changed files

- `src/components/UppyUploader.tsx`
- `server.js`

## Local verification

```bash
npm.cmd run build
node --check server.js
```

## Server deployment reminder

Copy the updated API server file to the production API server and restart the service:

```powershell
scp D:\Ai\gamexxxyx-v2-local\server.js root@your-server-ip:/opt/gamexxxyx-api/server.js
```

```bash
cd /opt/gamexxxyx-api
node --check server.js
systemctl restart gamexxxyx-api
systemctl status gamexxxyx-api --no-pager
```

## Production verification

Upload a file with a Chinese filename and confirm:

- The R2 object name is readable Chinese text.
- The returned `filename` keeps the Chinese filename.
- The returned `url` is browser-safe and opens correctly.
- The admin uploader displays a readable Chinese filename in the link field.
