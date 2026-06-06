# Localix - Simple Local Server Manager

![Localix Logo](build/icon.ico)

## What is Localix?

Localix is a simple local server manager for Windows. It helps you run Apache, PHP, MySQL, phpMyAdmin, Virtual Hosts, and Laravel projects from one clean desktop control panel.

Localix is designed for local web development. It focuses on simplicity, stability, and a smooth daily workflow, so you can start your local stack without touching complicated configuration files.

Localix does not install MySQL as a Windows Service. Services are managed as local application processes, keeping your system cleaner and easier to control.

Localix is built and developed independently. It may still have limitations, but it will continue to be improved, refined, and updated over time.

Enjoy building locally.

![Localix Dashboard](docs/ui-dashboard.svg)

## Features

**Simple Control Panel**  
Start, stop, and restart Apache and MySQL from one place.

**Local Stack Included**  
Apache, PHP 8.4, MySQL, phpMyAdmin, and Composer are bundled in the full release.

**No MySQL Windows Service**  
MySQL runs as a local Localix process and uses Localix's own data directory.

**Pretty Local Domains**  
Use optional `.locx` domains such as:

```text
http://my-project.locx
```

**Laravel Project Creator**  
Create new Laravel projects directly from Localix using Composer.

**PHP Version Ready**  
Localix supports manually adding other PHP versions through the runtime folder.

**Isolated Runtime**  
Runtime files, configs, project files, logs, and MySQL data live inside the Localix folder.

**Tray and Background Mode**  
Localix can run in the tray and optionally start with Windows in the background.

**Light, Dark, and System Theme**  
Choose the theme that fits your desktop.

## How Fast?

Localix is built to start your local environment quickly. Apache and MySQL are managed directly by the app, and Localix checks ports before starting services to avoid conflicts with other tools.

Default ports:

```text
Apache: 80
MySQL: 3306
```

If port `80` is already used by IIS, Laragon, XAMPP, Nginx, or another Apache instance, stop the other app or change the Apache port in Settings.

## How Easy?

Install Localix, open the app, and click:

```text
Start All
```

Then open:

```text
http://localhost
http://localhost/phpmyadmin
```

For Laravel projects created in the `www` folder, Localix automatically points Apache to the `public/` directory:

```text
http://localhost/my-project/
```

## Virtual Hosts

Virtual Hosts are optional and disabled by default.

When enabled, folders inside `www` can be accessed with `.locx` domains:

```text
www/ayamgeprek -> http://ayamgeprek.locx
```

Localix does not edit the Windows hosts file automatically. Add entries manually as Administrator:

```text
127.0.0.1 ayamgeprek.locx
```

Hosts file location:

```text
C:\Windows\System32\drivers\etc\hosts
```

## Download

Download the latest installer from the **Releases** page:

```text
Localix Setup.exe
```

The installer lets you choose the installation directory.

## Notes

- Localix is for local development, not public production servers.
- Root MySQL uses no password by default for local development.
- phpMyAdmin connects to MySQL through `127.0.0.1`.
- Logs are stored in the Localix logs folder.
- MySQL data is stored in the Localix data folder.

## License

Localix is proprietary software. The public release repository is intended for downloads, documentation, screenshots, and release notes only. Source code is not distributed publicly.
