# SecureOps – Secure Distributed Inventory & Risk Monitoring Platform

Premium React/Vite/Tailwind frontend demo for a university final project.

## Important fix
This project is pinned to Tailwind CSS v3.4.17 so the included `postcss.config.js` works without the Tailwind v4 PostCSS error.

If you previously installed dependencies and saw the error:

`It looks like you're trying to use tailwindcss directly as a PostCSS plugin`

run:

```bash
rm -rf node_modules package-lock.json
npm install
npm run dev
```

On Windows PowerShell:

```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm install
npm run dev
```

## Routes

Landing:
- `/`

Auth:
- `/login`
- `/register`

Admin:
- `/admin/dashboard`
- `/admin/products`
- `/admin/orders`
- `/admin/vault`
- `/admin/reports`
- `/admin/security`
- `/admin/attack-simulation`
- `/admin/audit-logs`
- `/admin/architecture`
- `/admin/settings`

User:
- `/user/dashboard`
- `/user/products`
- `/user/orders`
- `/user/files`
- `/user/profile`

## Notes
This is a frontend demo with mock data and simulated role navigation. It is ready to connect later to backend APIs.
