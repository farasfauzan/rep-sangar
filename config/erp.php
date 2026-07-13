<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Tax Rate
    |--------------------------------------------------------------------------
    |
    | Default tax rate (PPN) used for calculations throughout the ERP system.
    | Value 0.11 = 11% (current Indonesian PPN rate).
    |
    */

    'tax_rate' => (float) env('TAX_RATE', 0.11),

    /*
    |--------------------------------------------------------------------------
    | Currency
    |--------------------------------------------------------------------------
    |
    | Default currency used for pricing, invoicing, and financial reports.
    |
    */

    'currency' => env('DEFAULT_CURRENCY', 'IDR'),

    /*
    |--------------------------------------------------------------------------
    | Roles
    |--------------------------------------------------------------------------
    |
    | Role name to ID mapping used by the authorization system.
    |
    */

    'roles' => [
        'ADMIN'             => 1,
        'LAPANGAN'          => 2,
        'ENGINEER'          => 3,
        'PURCHASING_LEGAL'  => 4,
        'VERIFIKATOR_KEU'   => 5,
        'MGR_KOMERSIAL'     => 6,
        'KEU_KANTOR'        => 7,
        'PAJAK'             => 8,
        'ACCOUNTING'        => 9,
    ],

];
