<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InventoryStock extends Model
{
    use HasFactory;
    protected $fillable = ['project_id', 'rab_budget_id', 'item_name', 'unit', 'quantity', 'min_quantity', 'location'];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function rabBudget()
    {
        return $this->belongsTo(RabBudget::class, 'rab_budget_id')->withTrashed();
    }

    public function getLowStockAttribute(): bool
    {
        return $this->quantity <= $this->min_quantity;
    }
}
