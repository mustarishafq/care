<?php

namespace App\Services\Shopee;

use App\Models\ShopeeConnection;
use Illuminate\Support\Collection;
use RuntimeException;

class ShopeeService
{
    public function __construct(
        private readonly ShopeeAuthService $authService,
    ) {}

    /**
     * @return Collection<int, ShopeeConnection>
     */
    public function listConnections(): Collection
    {
        return ShopeeConnection::query()
            ->where('is_active', true)
            ->orderBy('shop_name')
            ->orderBy('id')
            ->get();
    }

    public function disconnect(ShopeeConnection $connection): void
    {
        $connection->update(['is_active' => false]);
    }

    /**
     * @return array{products: list<array<string, mixed>>, total_count: int|null, next_offset: int|null, has_next_page: bool}
     */
    public function listProducts(
        ShopeeConnection $connection,
        int $pageSize = 20,
        int $offset = 0,
        ?string $status = null,
    ): array {
        $connection = $this->ensureFreshToken($connection);
        $shopId = (int) $connection->shop_id;

        $query = [
            'offset' => max(0, $offset),
            'page_size' => min(max($pageSize, 1), 50),
            'item_status' => $status ?: 'NORMAL',
        ];

        $result = $this->client()->getItemList($connection->access_token, $shopId, $query);
        $itemIds = [];

        foreach ($result['item'] ?? [] as $item) {
            if (is_array($item) && isset($item['item_id'])) {
                $itemIds[] = (int) $item['item_id'];
            }
        }

        $products = [];

        if ($itemIds !== []) {
            $baseInfo = $this->client()->getItemBaseInfo($connection->access_token, $shopId, $itemIds);
            $infoMap = [];

            foreach ($baseInfo['item_list'] ?? [] as $info) {
                if (is_array($info) && isset($info['item_id'])) {
                    $infoMap[(string) $info['item_id']] = $info;
                }
            }

            foreach ($itemIds as $itemId) {
                $info = $infoMap[(string) $itemId] ?? ['item_id' => $itemId];
                $products[] = array_merge($info, [
                    'id' => (string) $itemId,
                    'product_id' => (string) $itemId,
                    'title' => $info['item_name'] ?? $info['name'] ?? null,
                    'status' => $info['item_status'] ?? $query['item_status'],
                ]);
            }
        }

        $connection->update(['last_synced_at' => now()]);

        $hasNext = (bool) ($result['has_next_page'] ?? false);
        $nextOffset = $hasNext ? ($query['offset'] + $query['page_size']) : null;

        return [
            'products' => $products,
            'total_count' => isset($result['total_count']) ? (int) $result['total_count'] : null,
            'next_offset' => $nextOffset,
            'has_next_page' => $hasNext,
        ];
    }

    /**
     * @param  array<string, mixed>  $query
     * @return array<string, mixed>
     */
    public function getComments(ShopeeConnection $connection, array $query = []): array
    {
        $connection = $this->ensureFreshToken($connection);

        $result = $this->client()->getComments(
            $connection->access_token,
            (int) $connection->shop_id,
            $query,
        );

        $connection->update(['last_synced_at' => now()]);

        return $result;
    }

    public function replyToComment(ShopeeConnection $connection, int $commentId, string $content): array
    {
        $connection = $this->ensureFreshToken($connection);

        return $this->client()->replyComment(
            $connection->access_token,
            (int) $connection->shop_id,
            $commentId,
            $content,
        );
    }

    private function ensureFreshToken(ShopeeConnection $connection): ShopeeConnection
    {
        if (! $connection->tokenNeedsRefresh()) {
            return $connection;
        }

        try {
            return $this->authService->refreshConnectionTokens($connection);
        } catch (RuntimeException $exception) {
            $connection->markConnectionError($exception->getMessage());
            throw new RuntimeException(
                'Shopee access token expired. Reconnect the shop or refresh the token.',
                previous: $exception,
            );
        }
    }

    private function client(): ShopeeApiClient
    {
        return ShopeeApiClient::fromConfig();
    }
}
