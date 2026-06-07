# Localix Installation Guide

Localix is a simple local server manager for Windows. It bundles Apache, PHP, MySQL, phpMyAdmin, a clean localhost dashboard, project scanning from the `www` folder, and Virtual Host helpers for local development.

## Requirements

- Windows 10 or Windows 11, 64-bit.
- Administrator access is recommended, especially when using Apache port `80` or editing the Windows hosts file.
- No separate PHP, Apache, or MySQL installation is required.

## Download

Download one of these files from the GitHub Release:

- `localix setup.exe` for the standard installer.
- `localix 0.1.0 x64.exe` for the portable build.

## Install With Setup

1. Run `localix setup.exe`.
2. Follow the installer steps.
3. Launch Localix from the Start Menu or Desktop shortcut.
4. If Windows asks for permission, allow it so Localix can manage local server processes.

## Use Portable Build

1. Run `localix 0.1.0 x64.exe`.
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

1. Open the `Virtual Hosts` menu.
2. Enable Virtual Host.
3. Generate the config.
4. Restart Apache if it is already running.
5. Update the Windows hosts file when prompted or copy the generated hosts entries manually.

## Troubleshooting

- If Apache cannot start on port `80`, run Localix as Administrator or change the Apache port in Settings.
- If MySQL cannot start, check whether another MySQL service is already using port `3306`.
- If a new Virtual Host domain does not work, regenerate config and restart Apache.
- If the localhost logo does not appear after an update, restart Apache so the generated Apache alias is active.

