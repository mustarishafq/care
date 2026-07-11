<?php

namespace App\Support;

class MarketplaceReviewImages
{
    /**
     * @param  array<string, mixed>|null  $metadata
     * @return list<array{url: string, thumb_url: string|null}>
     */
    public static function reviewImages(?array $metadata): array
    {
        if (! is_array($metadata)) {
            return [];
        }

        $images = $metadata['review_images']
            ?? $metadata['images']
            ?? $metadata['image_list']
            ?? [];

        if (! is_array($images)) {
            return [];
        }

        $result = [];
        foreach ($images as $image) {
            $normalized = self::normalizeImage($image);
            if ($normalized !== null) {
                $result[] = $normalized;
            }
        }

        return $result;
    }

    /**
     * @param  array<string, mixed>|null  $metadata
     */
    public static function productImageUrl(?array $metadata): ?string
    {
        if (! is_array($metadata)) {
            return null;
        }

        $productInfo = is_array($metadata['product_info'] ?? null) ? $metadata['product_info'] : [];
        $img = $productInfo['img']
            ?? $productInfo['image']
            ?? $metadata['product_image']
            ?? null;

        $normalized = self::normalizeImage($img);

        return $normalized['thumb_url'] ?? $normalized['url'] ?? null;
    }

    /**
     * @return array{url: string, thumb_url: string|null}|null
     */
    public static function normalizeImage(mixed $image): ?array
    {
        if (is_string($image) && filter_var($image, FILTER_VALIDATE_URL)) {
            return ['url' => $image, 'thumb_url' => $image];
        }

        if (! is_array($image)) {
            return null;
        }

        $url = self::firstUrl($image['url_list'] ?? null)
            ?? (is_string($image['url'] ?? null) ? $image['url'] : null)
            ?? (is_string($image['uri'] ?? null) && str_starts_with($image['uri'], 'http') ? $image['uri'] : null);

        $thumb = self::firstUrl($image['thumb_url_list'] ?? null)
            ?? (is_string($image['thumb_url'] ?? null) ? $image['thumb_url'] : null)
            ?? $url;

        if (! is_string($url) || $url === '') {
            return null;
        }

        return [
            'url' => $url,
            'thumb_url' => is_string($thumb) && $thumb !== '' ? $thumb : $url,
        ];
    }

    private static function firstUrl(mixed $list): ?string
    {
        if (! is_array($list) || $list === []) {
            return null;
        }

        $first = $list[0] ?? null;

        return is_string($first) && $first !== '' ? $first : null;
    }
}
