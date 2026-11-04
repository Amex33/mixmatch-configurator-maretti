<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

#[Fillable(['uuid', 'configurator_id', 'status', 'selections', 'customer', 'total', 'quote_only', 'magento_order_id', 'exported_at'])]
class Configuration extends Model
{
    public const STATUS_DRAFT = 'draft';
    public const STATUS_QUOTE_REQUESTED = 'quote_requested';
    public const STATUS_IN_CART = 'in_cart';
    public const STATUS_ORDERED = 'ordered';
    public const STATUS_EXPORTED = 'exported';

    protected static function booted(): void
    {
        static::creating(fn (Configuration $configuration) => $configuration->uuid ??= (string) Str::uuid());
    }

    protected function casts(): array
    {
        return [
            'selections' => 'array',
            'customer' => 'array',
            'total' => 'decimal:2',
            'quote_only' => 'boolean',
            'exported_at' => 'datetime',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'uuid';
    }

    public function configurator(): BelongsTo
    {
        return $this->belongsTo(Configurator::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(ConfigurationItem::class);
    }
}
