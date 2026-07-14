<?php

namespace App\Services;

use App\Models\SystemConfig;

class DisplayFormatService
{
    public const CONFIG_KEY = 'display_format';

    public const DEFAULTS = [
        'locale' => 'en-MY',
        'currency_code' => 'MYR',
        'currency_decimals' => 2,
        'date_format' => 'dd/MM/yyyy',
        'datetime_format' => 'dd/MM/yyyy HH:mm',
        'phone_country_code' => '+60',
    ];

    /**
     * @return array{
     *   locale: string,
     *   currency_code: string,
     *   currency_decimals: int,
     *   date_format: string,
     *   datetime_format: string,
     *   phone_country_code: string
     * }
     */
    public function getSettings(): array
    {
        $config = SystemConfig::query()->where('key', self::CONFIG_KEY)->first();
        $raw = is_array($config?->json_value) ? $config->json_value : [];

        return $this->normalize($raw);
    }

    /**
     * @param  array<string, mixed>  $raw
     * @return array{
     *   locale: string,
     *   currency_code: string,
     *   currency_decimals: int,
     *   date_format: string,
     *   datetime_format: string,
     *   phone_country_code: string
     * }
     */
    public function normalize(array $raw): array
    {
        $decimals = isset($raw['currency_decimals']) && is_numeric($raw['currency_decimals'])
            ? (int) $raw['currency_decimals']
            : self::DEFAULTS['currency_decimals'];

        return [
            'locale' => $this->stringOrDefault($raw['locale'] ?? null, self::DEFAULTS['locale']),
            'currency_code' => strtoupper($this->stringOrDefault($raw['currency_code'] ?? null, self::DEFAULTS['currency_code'])),
            'currency_decimals' => min(4, max(0, $decimals)),
            'date_format' => $this->stringOrDefault($raw['date_format'] ?? null, self::DEFAULTS['date_format']),
            'datetime_format' => $this->stringOrDefault($raw['datetime_format'] ?? null, self::DEFAULTS['datetime_format']),
            'phone_country_code' => $this->normalizeCountryCode(
                $raw['phone_country_code'] ?? self::DEFAULTS['phone_country_code'],
            ),
        ];
    }

    public function phoneCountryCode(): string
    {
        return $this->getSettings()['phone_country_code'];
    }

    /**
     * Normalize phone to E.164-style using the configured country code, e.g. +60139989571.
     */
    public function normalizePhone(mixed $value, ?string $countryCode = null): ?string
    {
        if ($value === null) {
            return null;
        }

        $raw = trim((string) $value);
        if ($raw === '') {
            return null;
        }

        $cc = $this->normalizeCountryCode($countryCode ?? $this->phoneCountryCode());
        $ccDigits = preg_replace('/\D+/', '', $cc) ?: '';
        $digits = preg_replace('/\D+/', '', $raw) ?: '';

        if ($digits === '') {
            return null;
        }

        if ($ccDigits !== '' && str_starts_with($digits, $ccDigits)) {
            $local = substr($digits, strlen($ccDigits));
        } else {
            $local = $digits;
        }

        // TikTok often returns "(+60)0139..." — strip local leading zeros.
        $local = preg_replace('/^0+/', '', $local) ?: '';

        if ($local === '') {
            return null;
        }

        return $cc.$local;
    }

    /**
     * Format TikTok contact address as: address, postcode, city, state, country.
     *
     * @param  array<string, mixed>  $address
     */
    public function formatAddress(array $address): string
    {
        $parts = $this->parseAddressParts($address);

        return implode(', ', array_values(array_filter([
            $parts['address'] !== '' ? $parts['address'] : null,
            $parts['postcode'] !== '' ? $parts['postcode'] : null,
            $parts['city'] !== '' ? $parts['city'] : null,
            $parts['state'] !== '' ? $parts['state'] : null,
            $parts['country'] !== '' ? $parts['country'] : null,
        ], fn ($part) => is_string($part) && $part !== '')));
    }

    /**
     * Split a TikTok/Seller Center address payload into discrete fields.
     *
     * @param  array<string, mixed>|null  $address
     * @return array{address: string, city: string, postcode: string, state: string, country: string}
     */
    public function parseAddressParts(?array $address): array
    {
        $empty = [
            'address' => '',
            'city' => '',
            'postcode' => '',
            'state' => '',
            'country' => '',
        ];

        if ($address === null || $address === []) {
            return $empty;
        }

        $items = [];
        foreach (is_array($address['items'] ?? null) ? $address['items'] : [] as $item) {
            if (! is_array($item)) {
                continue;
            }
            $key = strtolower(trim((string) ($item['key'] ?? '')));
            $value = trim((string) ($item['value'] ?? ''));
            if ($key !== '' && $value !== '') {
                $items[$key] = $value;
            }
        }

        $street = implode(', ', array_values(array_filter([
            $items['house_number'] ?? null,
            $items['address'] ?? null,
            $items['address_detail'] ?? null,
        ], fn ($part) => is_string($part) && $part !== '')));

        $postcode = trim((string) (
            $items['zipcode']
            ?? $items['postcode']
            ?? $items['postal_code']
            ?? $items['zip']
            ?? ''
        ));

        $districtNames = [];
        foreach (is_array($address['districts'] ?? null) ? $address['districts'] : [] as $district) {
            if (! is_array($district)) {
                continue;
            }
            $name = trim((string) ($district['name'] ?? ''));
            if ($name !== '' && ! in_array($name, $districtNames, true)) {
                $districtNames[] = $name;
            }
        }

        // TikTok MY usually returns [state, city].
        $state = $districtNames[0] ?? '';
        $city = $districtNames[1] ?? '';
        if ($city === '' && count($districtNames) === 1) {
            $city = $districtNames[0];
            $state = '';
        }

        // Prefer explicit city/state/district keys from items when present.
        $city = trim((string) ($items['city'] ?? $items['town'] ?? $city));
        $state = trim((string) ($items['state'] ?? $items['province'] ?? $state));
        if ($city === '' && isset($items['district'])) {
            $city = trim((string) $items['district']);
        }

        $region = is_array($address['region'] ?? null) ? $address['region'] : [];
        $country = trim((string) (
            $region['name']
            ?? $items['country']
            ?? $items['country_name']
            ?? ''
        ));

        return [
            'address' => $street,
            'city' => $city,
            'postcode' => $postcode,
            'state' => $state,
            'country' => $country,
        ];
    }

    private function normalizeCountryCode(mixed $value): string
    {
        $code = preg_replace('/[^\d+]/', '', (string) ($value ?? '')) ?: '';
        $code = ltrim($code);
        if ($code === '') {
            return self::DEFAULTS['phone_country_code'];
        }
        if (! str_starts_with($code, '+')) {
            $code = '+'.$code;
        }
        $digits = preg_replace('/\D+/', '', $code) ?: '';

        return $digits === '' ? self::DEFAULTS['phone_country_code'] : '+'.$digits;
    }

    private function stringOrDefault(mixed $value, string $default): string
    {
        if (! is_string($value)) {
            return $default;
        }
        $trimmed = trim($value);

        return $trimmed === '' ? $default : $trimmed;
    }
}
