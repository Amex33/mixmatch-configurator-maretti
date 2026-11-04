<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['configurator_component_id', 'key', 'name', 'group', 'sku', 'meta', 'sort', 'active'])]
class ComponentOption extends Model
{
    protected function casts(): array
    {
        return [
            'meta' => 'array',
            'active' => 'boolean',
        ];
    }

    public function component(): BelongsTo
    {
        return $this->belongsTo(ConfiguratorComponent::class, 'configurator_component_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'sku', 'sku');
    }

    public function attr(string $key, mixed $default = null): mixed
    {
        return data_get($this->meta, $key, $default);
    }
}
