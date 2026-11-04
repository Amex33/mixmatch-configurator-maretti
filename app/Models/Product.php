<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['sku', 'name', 'price', 'stock', 'discontinued', 'blocked', 'image_url', 'data'])]
class Product extends Model
{
    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'discontinued' => 'boolean',
            'blocked' => 'boolean',
            'data' => 'array',
        ];
    }
}
