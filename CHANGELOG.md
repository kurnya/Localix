# Changelog

All notable changes to Localix are documented in this file.

## [0.2.0] - 2026-10-10

Manage PHP versions, PHP extensions, and phpMyAdmin from inside Localix, with a simpler five-page layout.

### New

- PHP page: install, update, and switch PHP 8.2-8.5 and phpMyAdmin from inside the app. Files come from the official sites and are verified with SHA-256.
- Switch PHP from the dashboard or the tray menu; the previous version is restored if Apache fails to start.
- PHP extensions and php.ini settings with checkboxes, plus custom directives that are tested before they are applied.
- PHP in the terminal (optional): add the active PHP and Composer to the Windows PATH so `php artisan` and `composer` use the same version and settings as Localix.
- Simpler navigation: Dashboard, Projects, PHP, Logs, Settings.

### Improvements

- Updating keeps projects (`www`), databases (`data`), and settings (`config`), including when updating from 0.1.0.
- phpMyAdmin is served from its runtime folder, keeps the login across updates, and only opens on `localhost` / `127.0.0.1`.
- Per-service start, stop, and restart on the dashboard; Check Ports detects ports used by other applications.

### Fixes

- New Laravel projects returned HTTP 500 (SQLite extensions were not enabled).
- The Apache access log only contained the word `common`.
- Status badges were hard to read in the light theme.

### Release Assets

- `localix.setup.exe` - standard Windows installer.
- `localix.0.2.0.x64.exe` - portable Windows build.
- `SHA256SUMS.txt` - checksum file for release verification.

## [0.1.0] - 2026-06-07

Localix is a simple local server manager for Windows, built to make Apache, PHP, MySQL, phpMyAdmin, local projects, and Virtual Hosts easier to run from one desktop app.

### Highlights

- One-click service control for Apache and MySQL.
- Clean desktop dashboard for server status, ports, logs, settings, and shortcuts.
- Modern localhost landing page with Localix branding.
- Live project scanning from the `www` folder inside the application.
- Project list and Virtual Host views update while Localix is running.
- phpMyAdmin shortcut and bundled phpMyAdmin setup.
- Virtual Host generator for local project domains.
- Laravel project creation helper.
- Log viewer for Localix, Apache, MySQL, and related runtime output.
- Light, dark, and system theme support.

### Release Assets

- `localix setup.exe` - standard Windows installer.
- `localix 0.1.0 x64.exe` - portable Windows build.
- `Installation Guide.md` - installation and first-run guide.
- `SHA256SUMS.txt` - checksum file for release verification.

[0.2.0]: https://github.com/kurnya/Localix/releases/tag/v0.2.0
[0.1.0]: https://github.com/kurnya/Localix/releases/tag/v0.1.0
