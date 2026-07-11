<?php

namespace App\Support;

class TikTokShopScopes
{
    /**
     * Scopes Care expects from TikTok Shop Partner Center.
     *
     * @return list<array{scope: string, feature: string, partner_center_hint: string}>
     */
    public static function required(): array
    {
        return [
            [
                'scope' => 'seller.authorization.info',
                'feature' => 'Connect shops and list authorized sellers',
                'partner_center_hint' => 'Authorization / Shop authorization',
            ],
            [
                'scope' => 'seller.product.basic',
                'feature' => 'List products from connected shops',
                'partner_center_hint' => 'Product / Product basic (read)',
            ],
            [
                'scope' => 'seller.product.write',
                'feature' => 'Reply to product reviews (Open API)',
                'partner_center_hint' => 'Product / Product write',
            ],
        ];
    }

    /**
     * @return list<string>
     */
    public static function scopeNames(): array
    {
        return array_column(self::required(), 'scope');
    }

    /**
     * @param  list<string>|null  $grantedScopes
     * @return list<string>
     */
    public static function missing(?array $grantedScopes): array
    {
        if ($grantedScopes === null || $grantedScopes === []) {
            return self::scopeNames();
        }

        $granted = array_map('strtolower', $grantedScopes);

        return array_values(array_filter(
            self::scopeNames(),
            fn (string $scope): bool => ! in_array(strtolower($scope), $granted, true),
        ));
    }

    public static function isScopeError(string $message): bool
    {
        $normalized = strtolower($message);

        return str_contains($normalized, 'access scope')
            || str_contains($normalized, 'not authorized to access the endpoint')
            || str_contains($normalized, '105005');
    }

    public static function scopeErrorGuidance(?string $originalMessage = null): string
    {
        $scopes = implode(', ', self::scopeNames());
        $base = 'TikTok Shop denied the request because your Partner Center app is missing API scopes. '
            ."Enable these scopes for your service in Partner Center → App & Service → API permissions: {$scopes}. "
            .'After approval, disconnect and reconnect the shop so a new token is issued with the updated scopes.';

        if ($originalMessage) {
            return $originalMessage.' '.$base;
        }

        return $base;
    }
}
