<?php

/*
 * Ingang voor Vercel (runtime vercel-php). Alleen /tmp is daar schrijfbaar en
 * leeg bij elke nieuwe instantie, dus de demo-database en storage gaan naar /tmp.
 * Opgeslagen configuraties blijven daardoor alleen tijdelijk bestaan.
 */

$tmp = '/tmp/laravel';

$defaults = [
    'APP_ENV' => 'production',
    'APP_DEBUG' => 'false',
    'LOG_CHANNEL' => 'stderr',
    'DB_CONNECTION' => 'sqlite',
    'DB_DATABASE' => "$tmp/database.sqlite",
    'SESSION_DRIVER' => 'cookie',
    'CACHE_STORE' => 'array',
    'QUEUE_CONNECTION' => 'sync',
    'MAIL_MAILER' => 'log',
    'LARAVEL_STORAGE_PATH' => "$tmp/storage",
    'VIEW_COMPILED_PATH' => "$tmp/storage/framework/views",
    'APP_CONFIG_CACHE' => "$tmp/cache/config.php",
    'APP_EVENTS_CACHE' => "$tmp/cache/events.php",
    'APP_PACKAGES_CACHE' => "$tmp/cache/packages.php",
    'APP_ROUTES_CACHE' => "$tmp/cache/routes.php",
    'APP_SERVICES_CACHE' => "$tmp/cache/services.php",
];

foreach ($defaults as $key => $value) {
    if (getenv($key) === false) {
        putenv("$key=$value");
        $_ENV[$key] = $_SERVER[$key] = $value;
    }
}

foreach (['storage/framework/views', 'storage/framework/cache/data', 'storage/logs', 'cache'] as $dir) {
    if (! is_dir("$tmp/$dir")) {
        mkdir("$tmp/$dir", 0777, true);
    }
}

if (! file_exists("$tmp/database.sqlite")) {
    copy(__DIR__.'/../database/demo.sqlite', "$tmp/database.sqlite");
}

require __DIR__.'/../public/index.php';
