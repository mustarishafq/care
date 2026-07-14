<?php

namespace App\Services\Marketplace;

use App\Models\MarketplaceOrder;
use App\Models\MarketplaceShopConnection;
use App\Models\TikTokShopConnection;
use App\Services\DisplayFormatService;
use App\Services\TikTokShop\TikTokSellerReviewClient;
use App\Support\MarketplacePlatform;
use Carbon\Carbon;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

class MarketplaceOrderSyncService
{
    public function __construct(
        private readonly DisplayFormatService $displayFormat,
        private readonly MarketplaceCookieAlertService $cookieAlerts,
    ) {}

    /**
     * Active TikTok cookie shops eligible for scheduled order sync / phone reveal.
     *
     * @return \Illuminate\Support\Collection<int, MarketplaceShopConnection>
     */
    public function eligibleConnectionsForScheduledSync()
    {
        return MarketplaceShopConnection::query()
            ->where('is_active', true)
            ->whereIn('platform', MarketplacePlatform::all())
            ->orderBy('platform')
            ->orderBy('id')
            ->get()
            ->filter(fn (MarketplaceShopConnection $connection) => $this->supportsScheduledSync($connection))
            ->values();
    }

    public function supportsScheduledSync(MarketplaceShopConnection $connection): bool
    {
        // Order sync is TikTok Seller Center cookie shops only for now.
        if ($connection->platform !== MarketplacePlatform::TIKTOK_SHOP) {
            return false;
        }

        return $connection->usesSellerCookie();
    }

    /**
     * Sync orders for all active shops that support scheduled order pull (currently TikTok cookie shops).
     * Prefer dispatching SyncMarketplaceShopOrdersJob per shop from the scheduler to avoid timeouts.
     *
     * @return array{
     *   synced_shops: int,
     *   failed_shops: int,
     *   skipped_shops: int,
     *   cookie_alerts: int,
     *   orders_synced: int,
     *   orders_created: int,
     *   orders_updated: int
     * }
     */
    public function syncActiveShops(
        ?Carbon $startAt = null,
        ?Carbon $endAt = null,
        int $pageSize = 50,
        bool $fetchContacts = true,
        bool $fetchPhones = false,
    ): array {
        $rangeStart = ($startAt ?? now()->subDays(2))->copy()->startOfDay();
        $rangeEnd = ($endAt ?? now())->copy()->endOfDay();

        $connections = MarketplaceShopConnection::query()
            ->where('is_active', true)
            ->whereIn('platform', MarketplacePlatform::all())
            ->orderBy('platform')
            ->orderBy('id')
            ->get();

        $syncedShops = 0;
        $failedShops = 0;
        $skippedShops = 0;
        $cookieAlerts = 0;
        $ordersSynced = 0;
        $ordersCreated = 0;
        $ordersUpdated = 0;

        foreach ($connections as $connection) {
            if (! $this->supportsScheduledSync($connection)) {
                $skippedShops++;
                continue;
            }

            try {
                $result = $this->syncConnection(
                    $connection,
                    $pageSize,
                    true,
                    $rangeStart,
                    $rangeEnd,
                    $fetchContacts,
                    $fetchPhones,
                );

                if ($connection->connection_error) {
                    $connection->clearConnectionError();
                }

                $syncedShops++;
                $ordersSynced += (int) ($result['synced'] ?? 0);
                $ordersCreated += (int) ($result['created'] ?? 0);
                $ordersUpdated += (int) ($result['updated'] ?? 0);
            } catch (Throwable $exception) {
                $failedShops++;
                $cookieAlerts += $this->cookieAlerts->recordFailure(
                    $connection,
                    $exception,
                    'orders',
                    'marketplace:sync-orders',
                    'MarketplaceOrderSyncService',
                );
            }
        }

        return [
            'synced_shops' => $syncedShops,
            'failed_shops' => $failedShops,
            'skipped_shops' => $skippedShops,
            'cookie_alerts' => $cookieAlerts,
            'orders_synced' => $ordersSynced,
            'orders_created' => $ordersCreated,
            'orders_updated' => $ordersUpdated,
        ];
    }

    /**
     * @return array{
     *   synced: int,
     *   created: int,
     *   updated: int,
     *   contacts_synced: int,
     *   phones_synced: int,
     *   pages_fetched: int,
     *   reported_total: int
     * }
     */
    public function syncConnection(
        MarketplaceShopConnection $connection,
        int $pageSize = 50,
        bool $fetchAll = true,
        ?Carbon $startAt = null,
        ?Carbon $endAt = null,
        bool $fetchContacts = true,
        bool $fetchPhones = false,
    ): array {
        if ($connection->platform !== MarketplacePlatform::TIKTOK_SHOP) {
            throw new RuntimeException('Order sync is currently available for TikTok Shop cookie shops only.');
        }

        $tiktok = TikTokShopConnection::query()->findOrFail($connection->id);

        return $this->syncTikTokShopOrders(
            $tiktok,
            $pageSize,
            $fetchAll,
            $startAt,
            $endAt,
            $fetchContacts,
            $fetchPhones,
        );
    }

    /**
     * @return array{
     *   synced: int,
     *   created: int,
     *   updated: int,
     *   contacts_synced: int,
     *   phones_synced: int,
     *   pages_fetched: int,
     *   reported_total: int
     * }
     */
    public function syncTikTokShopOrders(
        TikTokShopConnection $connection,
        int $pageSize = 50,
        bool $fetchAll = true,
        ?Carbon $startAt = null,
        ?Carbon $endAt = null,
        bool $fetchContacts = true,
        bool $fetchPhones = false,
    ): array {
        $this->raiseTimeLimit(600);

        $client = TikTokSellerReviewClient::fromConnection($connection);
        $sellerId = $this->resolveSellerId($connection);

        $rangeStart = ($startAt ?? now()->subDays(7))->copy()->startOfDay();
        $rangeEnd = ($endAt ?? now())->copy()->endOfDay();
        // Larger pages = fewer list API round-trips. One window for the full range
        // (day-splitting only adds HTTP calls; order list paginates fine across weeks).
        $pageSize = min(max($pageSize, 1), 50);

        $synced = 0;
        $created = 0;
        $updated = 0;
        $contactsSynced = 0;
        $namesRevealed = 0;
        $addressesRevealed = 0;
        $phonesSynced = 0;
        $pagesFetched = 0;
        $reportedTotal = 0;
        $seen = [];
        /** @var list<MarketplaceOrder> $needsContact */
        $needsContact = [];

        // Phase 1: list + upsert only (fast).
        $offset = 0;
        $searchCursor = '';
        $guard = 0;

        while ($guard < 100) {
            $guard++;
            $result = $client->listOrders(
                $sellerId,
                $rangeStart->timestamp,
                $rangeEnd->timestamp,
                $offset,
                $pageSize,
                $searchCursor,
            );

            $pagesFetched++;
            $list = $result['list'];
            if ($guard === 1) {
                $reportedTotal = (int) $result['total'];
            }

            if ($list === []) {
                break;
            }

            foreach ($list as $orderPayload) {
                if (! is_array($orderPayload)) {
                    continue;
                }

                $orderId = (string) ($orderPayload['main_order_id'] ?? '');
                if ($orderId === '' || isset($seen[$orderId])) {
                    continue;
                }
                $seen[$orderId] = true;

                $order = $this->upsertTikTokOrder($connection, $orderPayload);
                $synced++;
                if ($order->wasRecentlyCreated) {
                    $created++;
                } else {
                    $updated++;
                }

                if ($fetchContacts && (
                    ! $this->hasText($order->buyer_name)
                    || ! $this->hasText($order->buyer_address)
                    || ($fetchPhones && ! $this->hasText($order->buyer_phone))
                )) {
                    $needsContact[] = $order;
                }
            }

            if (! $fetchAll || ! $result['has_more']) {
                break;
            }

            $searchCursor = $result['search_cursor'];
            $offset = $result['offset'] + max(1, $result['count']);
            if ($searchCursor === '' && count($list) < $pageSize) {
                break;
            }
        }

        // Phase 2: parallel name/address reveals in chunks (skip saved fields).
        if ($fetchContacts && $needsContact !== []) {
            $contactStats = $this->revealContactsInBatches(
                $client,
                $sellerId,
                $needsContact,
                $fetchPhones,
            );
            $contactsSynced = $contactStats['contacts_synced'];
            $namesRevealed = $contactStats['names_revealed'];
            $addressesRevealed = $contactStats['addresses_revealed'];
            $phonesSynced = $contactStats['phones_synced'];
        }

        $connection->forceFill(['last_synced_at' => now()])->save();

        return [
            'synced' => $synced,
            'created' => $created,
            'updated' => $updated,
            'contacts_synced' => $contactsSynced,
            'names_revealed' => $namesRevealed,
            'addresses_revealed' => $addressesRevealed,
            'unmasked' => $namesRevealed + $addressesRevealed + $phonesSynced,
            'phones_synced' => $phonesSynced,
            'pages_fetched' => $pagesFetched,
            'reported_total' => $reportedTotal,
        ];
    }

    /**
     * @param  list<MarketplaceOrder>  $orders
     * @return array{contacts_synced: int, names_revealed: int, addresses_revealed: int, phones_synced: int}
     */
    private function revealContactsInBatches(
        TikTokSellerReviewClient $client,
        string $sellerId,
        array $orders,
        bool $fetchPhones = false,
        int $chunkSize = 8,
    ): array {
        $contactsSynced = 0;
        $namesRevealed = 0;
        $addressesRevealed = 0;
        $phonesSynced = 0;
        $chunkSize = min(max($chunkSize, 1), 10);

        foreach (array_chunk($orders, $chunkSize) as $chunk) {
            $jobs = [];

            foreach ($chunk as $order) {
                if (! $this->hasText($order->buyer_name)) {
                    $jobs[] = ['order_id' => $order->external_order_id, 'type' => 0];
                }
                if (! $this->hasText($order->buyer_address)) {
                    $jobs[] = ['order_id' => $order->external_order_id, 'type' => 1];
                }
            }

            $results = $jobs === [] ? [] : $client->getBuyerContactInfoMany($sellerId, $jobs);

            foreach ($chunk as $order) {
                $orderId = $order->external_order_id;
                $nameData = $results[$orderId.':0'] ?? null;
                $addressData = $results[$orderId.':1'] ?? null;
                $changed = false;
                $name = $order->buyer_name;
                $address = $order->buyer_address;
                $addressRaw = is_array($order->buyer_address_raw) ? $order->buyer_address_raw : null;

                if (is_array($nameData)) {
                    $revealedName = $this->nullableString($nameData['plain_text_name'] ?? null);
                    if ($revealedName !== null) {
                        $name = $revealedName;
                        $namesRevealed++;
                        $changed = true;
                    }
                }

                if (is_array($addressData)) {
                    $newAddressRaw = is_array($addressData['plain_text_address'] ?? null)
                        ? $addressData['plain_text_address']
                        : null;
                    if ($newAddressRaw !== null) {
                        $addressRaw = $newAddressRaw;
                        $formatted = $this->displayFormat->formatAddress($addressRaw);
                        if ($formatted !== '') {
                            $address = $formatted;
                            $addressesRevealed++;
                            $changed = true;
                        }
                    }
                }

                if ($changed) {
                    $order->forceFill([
                        'buyer_name' => $name ?: $order->buyer_name,
                        'buyer_address' => $address ?: $order->buyer_address,
                        'buyer_address_raw' => $addressRaw ?: $order->buyer_address_raw,
                        'contact_synced_at' => now(),
                    ])->save();
                    $contactsSynced++;
                }

                if ($fetchPhones && ! $this->hasText($order->buyer_phone)) {
                    try {
                        if ($this->revealOrderPhone($client, $sellerId, $order)) {
                            $phonesSynced++;
                        }
                    } catch (RuntimeException $exception) {
                        Log::warning('marketplace.orders.phone_sync_failed', [
                            'order_id' => $orderId,
                            'message' => $exception->getMessage(),
                        ]);
                    }
                }
            }
        }

        return [
            'contacts_synced' => $contactsSynced,
            'names_revealed' => $namesRevealed,
            'addresses_revealed' => $addressesRevealed,
            'phones_synced' => $phonesSynced,
        ];
    }

    /**
     * Slow backfill for orders missing buyer name, address, and/or phone (oldest first).
     * Caps batch size to avoid TikTok reveal limits. Pass $startAt/$endAt to narrow the window;
     * omit both to process all eligible orders.
     *
     * @return array{
     *   attempted: int,
     *   revealed: int,
     *   names_revealed: int,
     *   addresses_revealed: int,
     *   phones_revealed: int,
     *   remaining: int,
     *   failed: int,
     *   blocked: int
     * }
     */
    public function revealMissingPhones(
        MarketplaceShopConnection $connection,
        int $limit = 15,
        ?Carbon $startAt = null,
        ?Carbon $endAt = null,
    ): array {
        if ($connection->platform !== MarketplacePlatform::TIKTOK_SHOP) {
            throw new RuntimeException('Contact reveal is currently available for TikTok Shop cookie shops only.');
        }

        $tiktok = TikTokShopConnection::query()->findOrFail($connection->id);
        $client = TikTokSellerReviewClient::fromConnection($tiktok);
        $sellerId = $this->resolveSellerId($tiktok);
        $limit = min(max($limit, 1), 30);

        $this->raiseTimeLimit(120 + ($limit * 2));

        // TikTok rejects contact reveal for closed / unpaid statuses (incl. delivered).
        $blockedStatuses = $this->contactRevealBlockedStatuses();

        $query = MarketplaceOrder::query()
            ->where('platform', MarketplacePlatform::TIKTOK_SHOP)
            ->where('marketplace_shop_connection_id', $connection->id)
            ->where(function (Builder $status) use ($blockedStatuses) {
                $status->whereNull('order_status')
                    ->orWhereNotIn('order_status', $blockedStatuses);
            })
            ->where(function (Builder $builder) {
                $builder
                    ->where(function (Builder $q) {
                        $q->whereNull('buyer_name')->orWhere('buyer_name', '');
                    })
                    ->orWhere(function (Builder $q) {
                        $q->whereNull('buyer_address')->orWhere('buyer_address', '');
                    })
                    ->orWhere(function (Builder $q) {
                        $q->whereNull('buyer_phone')->orWhere('buyer_phone', '');
                    });
            })
            ->when($startAt, fn (Builder $q) => $q->where('order_created_at', '>=', $startAt->copy()->startOfDay()))
            ->when($endAt, fn (Builder $q) => $q->where('order_created_at', '<=', $endAt->copy()->endOfDay()))
            // Prefer active fulfillment statuses, then oldest → newest.
            ->orderByRaw('CASE
                WHEN order_status IN (101, 111, 112, 114, 121) THEN 0
                ELSE 1
            END')
            ->orderBy('order_created_at')
            ->orderBy('id');

        $remainingBefore = (clone $query)->count();
        $orders = (clone $query)->limit($limit)->get();

        $attempted = 0;
        $revealed = 0;
        $namesRevealed = 0;
        $addressesRevealed = 0;
        $phonesRevealed = 0;
        $failed = 0;
        $blocked = 0;
        $chunkSize = 5;
        $chunks = $orders->chunk($chunkSize)->values();
        $chunkCount = $chunks->count();

        foreach ($chunks as $chunkIndex => $chunk) {
            $jobs = [];
            foreach ($chunk as $order) {
                if (! $this->hasText($order->buyer_name)) {
                    $jobs[] = ['order_id' => $order->external_order_id, 'type' => 0];
                }
                if (! $this->hasText($order->buyer_address)) {
                    $jobs[] = ['order_id' => $order->external_order_id, 'type' => 1];
                }
                if (
                    ! $this->hasText($order->buyer_phone)
                    && ($order->order_status === null || ! in_array((int) $order->order_status, $blockedStatuses, true))
                ) {
                    $jobs[] = ['order_id' => $order->external_order_id, 'type' => 2];
                }
            }

            if ($jobs === []) {
                continue;
            }

            try {
                $results = $client->getBuyerContactInfoMany($sellerId, $jobs);
            } catch (RuntimeException $exception) {
                if ($this->isCookieOrAuthFailure($exception->getMessage())) {
                    throw $exception;
                }

                $failed += $chunk->count();
                Log::warning('marketplace.orders.contact_reveal_batch_failed', [
                    'connection_id' => $connection->id,
                    'chunk' => $chunkIndex + 1,
                    'message' => $exception->getMessage(),
                ]);
                continue;
            }

            foreach ($chunk as $order) {
                $attempted++;
                $orderId = $order->external_order_id;
                $changed = false;
                $name = $order->buyer_name;
                $address = $order->buyer_address;
                $addressRaw = is_array($order->buyer_address_raw) ? $order->buyer_address_raw : null;
                $phone = $order->buyer_phone;

                $nameData = $results[$orderId.':0'] ?? null;
                if (is_array($nameData) && ! $this->hasText($name)) {
                    if ($this->isContactRevealRejected($nameData)) {
                        $blocked++;
                    } else {
                        $revealedName = $this->nullableString($nameData['plain_text_name'] ?? null);
                        if ($revealedName !== null) {
                            $name = $revealedName;
                            $namesRevealed++;
                            $changed = true;
                        }
                    }
                }

                $addressData = $results[$orderId.':1'] ?? null;
                if (is_array($addressData) && ! $this->hasText($address)) {
                    if ($this->isContactRevealRejected($addressData)) {
                        $blocked++;
                    } else {
                        $newAddressRaw = is_array($addressData['plain_text_address'] ?? null)
                            ? $addressData['plain_text_address']
                            : null;
                        if ($newAddressRaw !== null) {
                            $addressRaw = $newAddressRaw;
                            $formatted = $this->displayFormat->formatAddress($addressRaw);
                            if ($formatted !== '') {
                                $address = $formatted;
                                $addressesRevealed++;
                                $changed = true;
                            }
                        }
                    }
                }

                $phoneData = $results[$orderId.':2'] ?? null;
                if (is_array($phoneData) && ! $this->hasText($phone)) {
                    if ($this->isContactRevealRejected($phoneData)) {
                        $blocked++;
                    } else {
                        $extracted = $this->extractPhoneNumber($phoneData, $addressRaw);
                        if ($extracted !== null) {
                            $phone = $extracted;
                            $phonesRevealed++;
                            $changed = true;
                        }
                    }
                }

                if ($changed) {
                    $order->forceFill([
                        'buyer_name' => $name ?: $order->buyer_name,
                        'buyer_address' => $address ?: $order->buyer_address,
                        'buyer_address_raw' => $addressRaw ?: $order->buyer_address_raw,
                        'buyer_phone' => $phone ?: $order->buyer_phone,
                        'contact_synced_at' => now(),
                    ])->save();
                    $revealed++;
                }
            }

            if ($chunkIndex < $chunkCount - 1) {
                usleep(250000);
            }
        }

        return [
            'attempted' => $attempted,
            'revealed' => $revealed,
            'names_revealed' => $namesRevealed,
            'addresses_revealed' => $addressesRevealed,
            'phones_revealed' => $phonesRevealed,
            'failed' => $failed,
            'blocked' => $blocked,
            'remaining' => max(0, $remainingBefore - $revealed),
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function upsertTikTokOrder(TikTokShopConnection $connection, array $payload): MarketplaceOrder
    {
        $orderId = (string) ($payload['main_order_id'] ?? '');
        if ($orderId === '') {
            throw new RuntimeException('TikTok order payload is missing main_order_id.');
        }

        $trade = is_array($payload['trade_order_module'] ?? null) ? $payload['trade_order_module'] : [];
        $price = is_array($payload['price_module'] ?? null) ? $payload['price_module'] : [];
        $buyer = is_array($payload['buyer_info_module'] ?? null) ? $payload['buyer_info_module'] : [];
        $statusModule = is_array($payload['order_status_module'] ?? null) ? $payload['order_status_module'] : [];
        $statusRow = is_array($statusModule[0] ?? null) ? $statusModule[0] : [];

        $items = $this->normalizeItems(
            is_array($payload['sku_module'] ?? null) ? $payload['sku_module'] : [],
        );

        $grand = is_array($price['grand_total'] ?? null) ? $price['grand_total'] : [];
        $orderStatus = isset($statusRow['main_order_status']) ? (int) $statusRow['main_order_status'] : null;

        $attributes = [
            'buyer_nickname' => $this->nullableString($buyer['buyer_nickname'] ?? null),
            'items' => $items,
            'item_count' => array_sum(array_map(fn ($item) => (int) ($item['quantity'] ?? 0), $items)),
            'product_summary' => $this->productSummary($items),
            'order_status' => $orderStatus,
            'order_status_label' => $this->statusLabel($orderStatus),
            'grand_total' => isset($grand['price_val']) ? (float) $grand['price_val'] : null,
            'currency' => $this->nullableString($grand['currency'] ?? null) ?: 'MYR',
            'pay_method' => $this->nullableString($trade['pay_method'] ?? null),
            'order_created_at' => $this->normalizeTimestamp($trade['create_time'] ?? null),
            'paid_at' => $this->normalizeTimestamp($trade['payment_time'] ?? null),
            'raw_metadata' => $payload,
            'synced_at' => now(),
        ];

        return MarketplaceOrder::query()->updateOrCreate(
            [
                'platform' => MarketplacePlatform::TIKTOK_SHOP,
                'marketplace_shop_connection_id' => $connection->id,
                'external_order_id' => $orderId,
            ],
            $attributes,
        );
    }

    /**
     * @return array{
     *   synced: bool,
     *   phone_synced: bool,
     *   name_revealed: int,
     *   address_revealed: int
     * }
     */
    public function syncBuyerContact(
        TikTokSellerReviewClient $client,
        string $sellerId,
        MarketplaceOrder $order,
        bool $fetchPhones = false,
    ): array {
        $orderId = $order->external_order_id;
        $needsName = ! $this->hasText($order->buyer_name);
        $needsAddress = ! $this->hasText($order->buyer_address);
        $needsPhone = $fetchPhones && ! $this->hasText($order->buyer_phone);

        if (! $needsName && ! $needsAddress && ! $needsPhone) {
            return [
                'synced' => false,
                'phone_synced' => false,
                'name_revealed' => 0,
                'address_revealed' => 0,
            ];
        }

        $name = $order->buyer_name;
        $address = $order->buyer_address;
        $addressRaw = is_array($order->buyer_address_raw) ? $order->buyer_address_raw : null;
        $phone = $order->buyer_phone;
        $phoneSynced = false;
        $nameRevealed = 0;
        $addressRevealed = 0;
        $didFetch = false;

        if ($needsName) {
            $nameData = $client->getBuyerContactInfo($sellerId, $orderId, 0);
            $revealedName = $this->nullableString($nameData['plain_text_name'] ?? null);
            if ($revealedName !== null) {
                $name = $revealedName;
                $nameRevealed = 1;
            }
            $didFetch = true;
        }

        if ($needsAddress) {
            $addressData = $client->getBuyerContactInfo($sellerId, $orderId, 1);
            $newAddressRaw = is_array($addressData['plain_text_address'] ?? null)
                ? $addressData['plain_text_address']
                : null;
            if ($newAddressRaw !== null) {
                $addressRaw = $newAddressRaw;
                $formatted = $this->displayFormat->formatAddress($addressRaw);
                if ($formatted !== '') {
                    $address = $formatted;
                    $addressRevealed = 1;
                }
            }
            $didFetch = true;
        }

        if ($needsPhone) {
            $phoneData = $this->fetchPhoneContact($client, $sellerId, $orderId);
            $extracted = $this->extractPhoneNumber($phoneData, is_array($addressRaw) ? $addressRaw : null);
            if ($extracted !== null) {
                $phone = $extracted;
                $phoneSynced = true;
            }
            $didFetch = true;
        }

        if ($didFetch) {
            $order->forceFill([
                'buyer_name' => $name ?: $order->buyer_name,
                'buyer_phone' => $phone ?: $order->buyer_phone,
                'buyer_address' => $address ?: $order->buyer_address,
                'buyer_address_raw' => $addressRaw ?: $order->buyer_address_raw,
                'contact_synced_at' => now(),
            ])->save();
        }

        return [
            'synced' => $didFetch,
            'phone_synced' => $phoneSynced,
            'name_revealed' => $nameRevealed,
            'address_revealed' => $addressRevealed,
        ];
    }

    public function revealOrderPhone(
        TikTokSellerReviewClient $client,
        string $sellerId,
        MarketplaceOrder $order,
    ): bool {
        if ($this->hasText($order->buyer_phone)) {
            return false;
        }

        $phoneData = $this->fetchPhoneContact($client, $sellerId, $order->external_order_id);
        $phone = $this->extractPhoneNumber(
            $phoneData,
            is_array($order->buyer_address_raw) ? $order->buyer_address_raw : null,
        );

        if ($phone === null) {
            return false;
        }

        $order->forceFill([
            'buyer_phone' => $phone,
            'contact_synced_at' => now(),
        ])->save();

        return true;
    }

    private function resolveSellerId(TikTokShopConnection $connection): string
    {
        $sellerId = (string) $connection->shop_id;
        if ($sellerId !== '') {
            return $sellerId;
        }

        return TikTokSellerReviewClient::extractSellerIdFromCookie(
            TikTokSellerReviewClient::decryptCookie(
                is_array($connection->metadata) ? ($connection->metadata['seller_cookie'] ?? null) : null,
            ),
        );
    }

    private function raiseTimeLimit(int $seconds): void
    {
        if (function_exists('set_time_limit')) {
            @set_time_limit($seconds);
        }

        if (function_exists('ini_set')) {
            @ini_set('max_execution_time', (string) $seconds);
        }
    }

    private function hasText(mixed $value): bool
    {
        return $this->nullableString($value) !== null;
    }

    /**
     * Order statuses TikTok will not unmask buyer contact for.
     *
     * @return list<int>
     */
    private function contactRevealBlockedStatuses(): array
    {
        return [
            100, // Unpaid
            102, // Delivered
            104, // Cancelled
            122, // Delivered
            130, // Completed
            140, // Cancelled
        ];
    }

    /**
     * @param  array<string, mixed>  $contactData
     */
    private function isContactRevealRejected(array $contactData): bool
    {
        $message = strtolower(trim((string) ($contactData['rejection_message'] ?? '')));

        return $message !== '' && (
            str_contains($message, "can't view")
            || str_contains($message, 'cannot view')
            || str_contains($message, 'unpaid')
            || str_contains($message, 'canceled')
            || str_contains($message, 'cancelled')
            || str_contains($message, 'completed')
            || str_contains($message, 'delivered')
        );
    }

    private function isCookieOrAuthFailure(string $message): bool
    {
        $normalized = strtolower($message);

        return str_contains($normalized, 'seller_token')
            || str_contains($normalized, 'cookie expired')
            || str_contains($normalized, 'cookie is missing')
            || str_contains($normalized, 'fresh cookie')
            || str_contains($normalized, 'security check');
    }

    /**
     * @return array<string, mixed>
     */
    private function fetchPhoneContact(
        TikTokSellerReviewClient $client,
        string $sellerId,
        string $orderId,
    ): array {
        try {
            $last = $client->getBuyerContactInfo($sellerId, $orderId, 2);
            if ($this->extractPhoneNumber($last, null) !== null) {
                return $last;
            }
        } catch (RuntimeException $exception) {
            Log::warning('marketplace.orders.phone_sync_failed', [
                'order_id' => $orderId,
                'message' => $exception->getMessage(),
            ]);

            return [];
        }

        return is_array($last ?? null) ? $last : [];
    }

    /**
     * @param  array<string, mixed>  $phoneData
     * @param  array<string, mixed>|null  $addressRaw
     */
    private function extractPhoneNumber(array $phoneData, ?array $addressRaw): ?string
    {
        foreach ([
            'plain_text_phone_number',
            'phone_number',
            'mobile',
            'phone',
            'plain_text_mobile',
        ] as $key) {
            $normalized = $this->displayFormat->normalizePhone($phoneData[$key] ?? null);
            if ($normalized !== null) {
                return $normalized;
            }
        }

        foreach (is_array($addressRaw['items'] ?? null) ? $addressRaw['items'] : [] as $item) {
            if (! is_array($item)) {
                continue;
            }
            $key = strtolower((string) ($item['key'] ?? ''));
            if (! in_array($key, ['phone', 'mobile', 'phone_number', 'post_tel', 'tel'], true)) {
                continue;
            }
            $value = $this->nullableString($item['value'] ?? null);
            if ($value !== null && ! str_contains($value, '*')) {
                return $this->displayFormat->normalizePhone($value);
            }
        }

        return null;
    }

    /**
     * @return LengthAwarePaginator<int, MarketplaceOrder>
     */
    public function listOrders(
        ?string $platform = null,
        ?int $shopConnectionId = null,
        ?string $orderId = null,
        ?string $buyerQuery = null,
        ?string $productName = null,
        int $perPage = 20,
        int $page = 1,
        ?Carbon $startAt = null,
        ?Carbon $endAt = null,
        ?array $orderStatuses = null,
    ): LengthAwarePaginator {
        return $this->filteredOrdersQuery(
            $platform,
            $shopConnectionId,
            $orderId,
            $buyerQuery,
            $productName,
            $startAt,
            $endAt,
            $orderStatuses,
        )
            ->with('shopConnection')
            ->orderByDesc('order_created_at')
            ->orderByDesc('id')
            ->paginate($perPage, ['*'], 'page', $page);
    }

    /**
     * All orders matching the list filters for exports.
     *
     * @return Builder<MarketplaceOrder>
     */
    public function filteredOrdersForExport(
        ?string $platform = null,
        ?int $shopConnectionId = null,
        ?string $orderId = null,
        ?string $buyerQuery = null,
        ?string $productName = null,
        ?Carbon $startAt = null,
        ?Carbon $endAt = null,
        ?array $orderStatuses = null,
    ): Builder {
        return $this->filteredOrdersQuery(
            $platform,
            $shopConnectionId,
            $orderId,
            $buyerQuery,
            $productName,
            $startAt,
            $endAt,
            $orderStatuses,
        )
            ->with('shopConnection')
            ->orderByDesc('order_created_at')
            ->orderByDesc('id');
    }

    /**
     * @return array{total: int, with_contact: int, without_contact: int, with_phone: int, missing_phone: int, items: int}
     */
    public function orderStats(
        ?string $platform = null,
        ?int $shopConnectionId = null,
        ?string $orderId = null,
        ?string $buyerQuery = null,
        ?string $productName = null,
        ?Carbon $startAt = null,
        ?Carbon $endAt = null,
        ?array $orderStatuses = null,
    ): array {
        $query = $this->filteredOrdersQuery(
            $platform,
            $shopConnectionId,
            $orderId,
            $buyerQuery,
            $productName,
            $startAt,
            $endAt,
            $orderStatuses,
        );

        $total = (clone $query)->count();
        $withContact = (clone $query)
            ->where(function (Builder $builder) {
                $builder->whereNotNull('buyer_name')
                    ->where('buyer_name', '!=', '')
                    ->orWhere(function (Builder $inner) {
                        $inner->whereNotNull('buyer_phone')->where('buyer_phone', '!=', '');
                    });
            })
            ->count();
        $withPhone = (clone $query)
            ->whereNotNull('buyer_phone')
            ->where('buyer_phone', '!=', '')
            ->count();

        return [
            'total' => $total,
            'with_contact' => $withContact,
            'without_contact' => max(0, $total - $withContact),
            'with_phone' => $withPhone,
            'missing_phone' => max(0, $total - $withPhone),
            'items' => (int) (clone $query)->sum('item_count'),
        ];
    }

    /**
     * @return list<int>|null Null means no status filter. Empty means invalid filter.
     */
    public static function resolveStatusFilter(?string $value): ?array
    {
        if ($value === null || trim($value) === '' || $value === 'all') {
            return null;
        }

        $key = strtolower(trim($value));
        $groups = [
            'unpaid' => [100],
            'to_ship' => [101, 111],
            'awaiting_collection' => [112],
            'partially_shipping' => [114],
            'in_transit' => [121],
            'delivered' => [102, 122],
            'completed' => [130],
            'cancelled' => [104, 140],
        ];

        if (isset($groups[$key])) {
            return $groups[$key];
        }

        if (ctype_digit($key)) {
            return [(int) $key];
        }

        return [];
    }

    private function filteredOrdersQuery(
        ?string $platform,
        ?int $shopConnectionId,
        ?string $orderId,
        ?string $buyerQuery,
        ?string $productName,
        ?Carbon $startAt,
        ?Carbon $endAt,
        ?array $orderStatuses = null,
    ): Builder {
        return MarketplaceOrder::query()
            ->when($platform, fn (Builder $query) => $query->where('platform', $platform))
            ->when($shopConnectionId, fn (Builder $query) => $query->where('marketplace_shop_connection_id', $shopConnectionId))
            ->when($orderId, fn (Builder $query) => $query->where('external_order_id', 'like', '%'.$orderId.'%'))
            ->when($buyerQuery, function (Builder $query) use ($buyerQuery) {
                $like = '%'.$buyerQuery.'%';
                $query->where(function (Builder $inner) use ($like) {
                    $inner->where('buyer_name', 'like', $like)
                        ->orWhere('buyer_nickname', 'like', $like)
                        ->orWhere('buyer_phone', 'like', $like);
                });
            })
            ->when($productName, fn (Builder $query) => $query->where('product_summary', 'like', '%'.$productName.'%'))
            ->when($orderStatuses !== null && $orderStatuses !== [], fn (Builder $query) => $query->whereIn('order_status', $orderStatuses))
            ->when($startAt, fn (Builder $query) => $query->where('order_created_at', '>=', $startAt->copy()->startOfDay()))
            ->when($endAt, fn (Builder $query) => $query->where('order_created_at', '<=', $endAt->copy()->endOfDay()));
    }

    /**
     * @param  list<array<string, mixed>>  $skuModule
     * @return list<array<string, mixed>>
     */
    private function normalizeItems(array $skuModule): array
    {
        $items = [];

        foreach ($skuModule as $sku) {
            if (! is_array($sku)) {
                continue;
            }

            $image = is_array($sku['product_image'] ?? null) ? $sku['product_image'] : [];
            $urlList = is_array($image['url_list'] ?? null) ? $image['url_list'] : [];
            $thumbList = is_array($image['thumb_url_list'] ?? null) ? $image['thumb_url_list'] : [];
            $unit = is_array($sku['sku_unit_price'] ?? null) ? $sku['sku_unit_price'] : [];
            $total = is_array($sku['sku_total_price'] ?? null) ? $sku['sku_total_price'] : [];

            $items[] = [
                'sku_id' => $this->nullableString($sku['sku_id'] ?? null),
                'product_id' => $this->nullableString($sku['product_id'] ?? null),
                'product_name' => $this->nullableString($sku['product_name'] ?? null),
                'sku_name' => $this->nullableString($sku['sku_name'] ?? null),
                'seller_sku_name' => $this->nullableString($sku['seller_sku_name'] ?? null),
                'quantity' => (int) ($sku['quantity'] ?? 0),
                'unit_price' => isset($unit['price_val']) ? (float) $unit['price_val'] : null,
                'unit_price_formatted' => $this->nullableString($unit['format_price'] ?? null),
                'total_price' => isset($total['price_val']) ? (float) $total['price_val'] : null,
                'total_price_formatted' => $this->nullableString($total['format_price'] ?? null),
                'image_url' => $this->nullableString($urlList[0] ?? $thumbList[0] ?? null),
            ];
        }

        return $items;
    }

    /**
     * @param  list<array<string, mixed>>  $items
     */
    private function productSummary(array $items): ?string
    {
        $names = [];
        foreach ($items as $item) {
            $name = trim((string) ($item['product_name'] ?? ''));
            if ($name !== '') {
                $names[] = $name;
            }
        }

        if ($names === []) {
            return null;
        }

        $summary = implode(', ', $names);

        return mb_strlen($summary) > 240 ? mb_substr($summary, 0, 237).'…' : $summary;
    }

    private function statusLabel(?int $status): ?string
    {
        if ($status === null) {
            return null;
        }

        return match ($status) {
            100 => 'Unpaid',
            101, 111 => 'To ship',
            102 => 'Delivered',
            104 => 'Cancelled',
            112 => 'Awaiting collection',
            114 => 'Partially shipping',
            121 => 'In transit',
            122 => 'Delivered',
            130 => 'Completed',
            140 => 'Cancelled',
            default => 'Status '.$status,
        };
    }

    private function normalizeTimestamp(mixed $value): ?Carbon
    {
        if ($value === null || $value === '' || $value === 0 || $value === '0') {
            return null;
        }

        if (! is_numeric($value)) {
            try {
                return Carbon::parse((string) $value);
            } catch (\Throwable) {
                return null;
            }
        }

        $number = (int) $value;
        if ($number > 1_000_000_000_000) {
            $number = (int) floor($number / 1000);
        }

        return Carbon::createFromTimestamp($number);
    }

    private function nullableString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $text = trim((string) $value);

        return $text === '' ? null : $text;
    }

}
