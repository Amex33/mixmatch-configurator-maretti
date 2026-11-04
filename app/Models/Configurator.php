<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;

#[Fillable(['slug', 'name', 'description', 'settings', 'sort', 'active'])]
class Configurator extends Model
{
    protected function casts(): array
    {
        return [
            'settings' => 'array',
            'active' => 'boolean',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    public function components(): HasMany
    {
        return $this->hasMany(ConfiguratorComponent::class)->orderBy('step');
    }

    public function options(): HasManyThrough
    {
        return $this->hasManyThrough(ComponentOption::class, ConfiguratorComponent::class);
    }

    public function component(string $key): ?ConfiguratorComponent
    {
        return $this->components->firstWhere('key', $key);
    }

    public function setting(string $key, mixed $default = null): mixed
    {
        return data_get($this->settings, $key, $default);
    }
}
