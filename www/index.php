<?php
$apachePort = 80;
$mysqlPort = 3306;
$mysqlStatus = 'MySQL not connected';
$mysqli = @new mysqli('127.0.0.1', 'root', '', '', $mysqlPort);
if (!$mysqli->connect_errno) {
    $mysqlStatus = 'MySQL connected';
    $mysqli->close();
}
$projects = array_filter(scandir(__DIR__), function ($item) {
    return $item !== '.' && $item !== '..' && $item !== 'phpmyadmin' && is_dir(__DIR__ . DIRECTORY_SEPARATOR . $item);
});
?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Localix is running</title>
    <link rel="icon" href="/_localix/icon.ico">
    <style>
        :root {
            --bg: #F8FAFC;
            --panel: #FFFFFF;
            --panel-soft: #F1F5F9;
            --border: rgba(148, 163, 184, 0.42);
            --text: #0F172A;
            --secondary: #475569;
            --muted: #64748B;
            --primary: #0EA5E9;
            --primary-soft: rgba(14, 165, 233, 0.12);
            --success: #16A34A;
            --warning: #D97706;
            --shadow: 0 18px 46px rgba(15, 23, 42, 0.1);
        }

        @media (prefers-color-scheme: dark) {
            :root {
                --bg: #0F172A;
                --panel: #111827;
                --panel-soft: #1E293B;
                --border: rgba(51, 65, 85, 0.78);
                --text: #E5E7EB;
                --secondary: #94A3B8;
                --muted: #64748B;
                --primary: #38BDF8;
                --primary-soft: rgba(56, 189, 248, 0.11);
                --success: #22C55E;
                --warning: #F59E0B;
                --shadow: 0 18px 52px rgba(0, 0, 0, 0.22);
            }
        }

        * { box-sizing: border-box; }

        body {
            margin: 0;
            min-height: 100vh;
            background: var(--bg);
            color: var(--text);
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        main {
            width: min(980px, calc(100% - 40px));
            margin: 0 auto;
            padding: 52px 0;
        }

        .hero {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 18px;
            margin-bottom: 18px;
        }

        h1, h2, p { margin: 0; }

        h1 {
            font-size: clamp(32px, 5vw, 44px);
            line-height: 1;
            letter-spacing: 0;
        }

        .brand {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 20px;
            color: var(--secondary);
            font-size: 13px;
            font-weight: 900;
            text-transform: uppercase;
        }

        .brand-mark {
            display: grid;
            width: 46px;
            height: 46px;
            place-items: center;
            border-radius: 12px;
            overflow: hidden;
        }

        .brand-logo {
            display: block;
            width: 42px;
            height: 42px;
            object-fit: contain;
        }

        .status-pill {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            border: 1px solid rgba(34, 197, 94, 0.36);
            border-radius: 999px;
            background: rgba(34, 197, 94, 0.12);
            color: var(--success);
            padding: 8px 12px;
            font-size: 13px;
            font-weight: 900;
            white-space: nowrap;
        }

        .dot {
            width: 8px;
            height: 8px;
            border-radius: 999px;
            background: currentColor;
            box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.14);
        }

        .grid {
            display: grid;
            grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
            gap: 16px;
        }

        .card {
            min-width: 0;
            border: 1px solid var(--border);
            border-radius: 14px;
            background: var(--panel);
            box-shadow: var(--shadow);
            padding: 20px;
        }

        .section-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 16px;
        }

        h2 { font-size: 18px; }

        .metrics {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
            margin-bottom: 16px;
        }

        .metric {
            border: 1px solid var(--border);
            border-radius: 12px;
            background: var(--panel-soft);
            padding: 13px;
        }

        .metric span {
            display: block;
            color: var(--muted);
            font-size: 12px;
            font-weight: 900;
            text-transform: uppercase;
        }

        .metric strong {
            display: block;
            margin-top: 6px;
            color: var(--text);
            font-size: 15px;
            overflow-wrap: anywhere;
        }

        .ok { color: var(--success); }
        .bad { color: var(--warning); }

        .actions {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            border-top: 1px solid var(--border);
            padding-top: 16px;
        }

        a {
            color: inherit;
            text-decoration: none;
        }

        .button {
            display: inline-flex;
            min-height: 40px;
            align-items: center;
            justify-content: center;
            border: 1px solid var(--primary);
            border-radius: 12px;
            background: var(--primary);
            color: #082F49;
            padding: 9px 14px;
            font-size: 13px;
            font-weight: 900;
        }

        .ghost {
            border-color: var(--border);
            background: transparent;
            color: var(--secondary);
        }

        .project-list {
            display: grid;
            gap: 9px;
        }

        .empty {
            border: 1px solid var(--border);
            border-radius: 12px;
            background: var(--panel-soft);
            color: var(--secondary);
            padding: 16px;
            font-size: 14px;
            line-height: 1.5;
        }

        .project-link {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            border: 1px solid var(--border);
            border-radius: 12px;
            background: var(--panel-soft);
            padding: 13px 14px;
            color: var(--text);
            font-size: 14px;
            font-weight: 900;
        }

        .project-link span:last-child {
            color: var(--primary);
            font-size: 12px;
        }

        @media (max-width: 760px) {
            main { width: min(100% - 28px, 980px); padding: 28px 0; }
            .hero, .section-head { display: grid; }
            .grid, .metrics { grid-template-columns: 1fr; }
            .status-pill { width: max-content; }
        }
    </style>
</head>
<body>
<main>
    <div class="brand">
        <span class="brand-mark"><img class="brand-logo" src="/_localix/icon.ico" alt="Localix"></span>
        <span>Localix</span>
    </div>
    <header class="hero">
        <div>
            <h1>Localix is running</h1>
        </div>
        <div class="status-pill"><span class="dot"></span> Apache active</div>
    </header>
    <div class="grid">
        <section class="card">
            <div class="section-head">
                <h2>Server status</h2>
                <span class="<?php echo $mysqlStatus === 'MySQL connected' ? 'ok' : 'bad'; ?>"><?php echo $mysqlStatus; ?></span>
            </div>
            <div class="metrics">
                <div class="metric"><span>PHP version</span><strong><?php echo PHP_VERSION; ?></strong></div>
                <div class="metric"><span>MySQL</span><strong class="<?php echo $mysqlStatus === 'MySQL connected' ? 'ok' : 'bad'; ?>"><?php echo $mysqlStatus; ?></strong></div>
                <div class="metric"><span>Apache port</span><strong>:<?php echo $apachePort; ?></strong></div>
                <div class="metric"><span>MySQL port</span><strong>:<?php echo $mysqlPort; ?></strong></div>
            </div>
            <div class="actions">
                <a class="button" href="/phpmyadmin">Open phpMyAdmin</a>
                <a class="button ghost" href="/">Refresh status</a>
            </div>
        </section>
        <section class="card">
            <div class="section-head">
                <h2>Projects</h2>
            </div>
        <?php if (empty($projects)): ?>
            <div class="empty">No project folders yet. Put projects inside the www folder.</div>
        <?php else: ?>
            <div class="project-list">
                <?php foreach ($projects as $project): ?>
                    <a class="project-link" href="/<?php echo rawurlencode($project); ?>/">
                        <span><?php echo htmlspecialchars($project, ENT_QUOTES); ?></span>
                        <span>Open</span>
                    </a>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>
        </section>
    </div>
</main>
</body>
</html>
