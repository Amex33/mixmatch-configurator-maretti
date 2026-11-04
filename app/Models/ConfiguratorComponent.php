<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['configurator_id', 'key', 'name', 'description', 'step'])]
class ConfiguratorComponent extends Model
{
    public function configurator(): BelongsTo
    {
        return $this->belongsTo(Configurator::class);
    }

    public function options(): HasMany
    {
        return $this->hasMany(ComponentOption::class)->where('active', true)->orderBy('sort');
    }

    public function option(?string $key): ?ComponentOption
    {
        return $key === null ? null : $this->options->firstWhere('key', $key);
    }
}
