# Localix Installation Guide

Localix is a simple local server manager for Windows. It bundles Apache, PHP, MySQL, phpMyAdmin, a clean localhost dashboard, project scanning from the `www` folder, and Virtual Host helpers for local development.

## Requirements

- Windows 10 or Windows 11, 64-bit.
- Administrator access is recommended, especially when using Apache port `80` or editing the Windows hosts file.
- No separate PHP, Apache, or MySQL installation is required.

## Download

Download one of these files from the latest GitHub Release:

- `localix.setup.exe` for the standard installer.
- `localix.<version>.x64.exe` (for example `localix.0.2.0.x64.exe`) for the portable build.

Release page:

```text
https://github.com/kurnya/Localix/releases/latest
```

## Install With Setup

1. Run `localix.setup.exe`.
2. Follow the installer steps.
3. Launch Localix from the Start Menu or Desktop shortcut.
4. If Windows asks for permission, allow it so Localix can manage local server processes.

## Use Portable Build

1. Run `localix.<version>.x64.exe`.
2. Choose or keep the default extraction location.
3. Open Localix from the portable output.

## First Run

1. Open Localix.
2. Click `Start All` to start Apache and MySQL.
3. Open `Localhost` from the dashboard.
4. Put your projects inside the `www` folder.
5. The Projects menu scans the `www` folder while the app is running.

## Project Folder Rules

- Put project folders directly inside `www`.
- `phpmyadmin` is reserved and ignored by the project scanner.
- For Laravel projects, Localix uses the `public` folder automatically when available.

## Virtual Hosts

Virtual Hosts can generate local domains such as `my-project.locx`.

1. Open the `Projects` page.
2. Turn on `Virtual host`, keep or change the suffix, and click `Simpan`.
3. Click `Copy hosts entry` (or `Buka hosts file`) and paste the entries into the Windows hosts file.
4. If a new project's domain is missing, click `Regenerate`.

## PHP Versions

PHP 8.4 is included. PHP 8.2, 8.3, and 8.5 can be installed from the app.

1. Open the `PHP` page.
2. On the `Versi` tab, click `Install` next to the version you want, then `Aktifkan`.
3. You can also switch the active version from the dashboard or the tray menu.
4. Use the `Extensions` and `Pengaturan` tabs to change extensions and `php.ini` settings, then click `Simpan & terapkan`.
5. (Optional) On the `Pengaturan` tab, turn on `Pakai PHP Localix di terminal` to add the active PHP and Composer to the Windows PATH. Open a new terminal afterwards so `php artisan` and `composer` use Localix's PHP.

Updating Localix keeps your projects (`www`), databases (`data`), and settings (`config`).

## Troubleshooting

- If Apache cannot start on port `80`, run Localix as Administrator or change the Apache port in Settings.
- If MySQL cannot start, check whether another MySQL service is already using port `3306`.
- If a new Virtual Host domain does not work, click `Regenerate` on the Projects page and check the hosts file entry.
- If Apache fails to start after switching PHP versions, Localix restores the previous version. Check the PHP Error and Apache Error logs on the Logs page.
- If the localhost logo does not appear after an update, restart Apache so the generated Apache alias is active.

## Security Notice

Localix is currently distributed as an unsigned Windows app. Because Localix is a new application and includes local server binaries such as Apache, PHP, MySQL, and phpMyAdmin, Windows SmartScreen or antivirus software may show an unknown publisher warning or ask for extra confirmation before running it.

This warning can happen with new unsigned apps even when the app is intended only for local development. Only download Localix from the official GitHub Release page:

```text
https://github.com/kurnya/Localix/releases
```

If needed, verify the downloaded files with `SHA256SUMS.txt` or scan the installer with Windows Security before installing.
