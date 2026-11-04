<?php

use Illuminate\Support\Facades\Route;

Route::redirect('/', '/configurator');

// Lokaal testen; op maretti.com/configurator laadt een Magento CMS-pagina dezelfde bundel.
Route::view('/configurator', 'configurator');
