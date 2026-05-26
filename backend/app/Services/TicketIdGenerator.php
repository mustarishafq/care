<?php

namespace App\Services;

use App\Models\Complaint;
use Illuminate\Support\Str;

class TicketIdGenerator
{
    public function generate(): string
    {
        do {
            $ticketId = 'TKT-'.strtoupper(Str::random(8));
        } while (Complaint::where('ticket_id', $ticketId)->exists());

        return $ticketId;
    }
}
