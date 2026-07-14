<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AuthorizesPermissions;
use App\Http\Controllers\Controller;
use App\Http\Resources\MarketplaceOrderResource;
use App\Models\MarketplaceOrder;
use App\Models\MarketplaceShopConnection;
use App\Services\DisplayFormatService;
use App\Services\Marketplace\MarketplaceOrderSyncService;
use App\Support\MarketplacePlatform;
use App\Support\SimpleXlsxWriter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class MarketplaceOrderController extends Controller
{
    use AuthorizesPermissions;

    public function __construct(
        private readonly MarketplaceOrderSyncService $orderSync,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->ensurePermission($request->user(), 'orders.view');

        $validated = $request->validate([
            'platform' => ['sometimes', 'nullable', 'string', 'max:32'],
            'shop_connection_id' => ['sometimes', 'nullable', 'integer'],
            'order_id' => ['sometimes', 'nullable', 'string', 'max:64'],
            'buyer' => ['sometimes', 'nullable', 'string', 'max:255'],
            'product_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'order_status' => ['sometimes', 'nullable', 'string', 'max:64'],
            'start_date' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'end_date' => ['sometimes', 'nullable', 'date_format:Y-m-d', 'after_or_equal:start_date'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        if (! empty($validated['platform']) && ! MarketplacePlatform::isValid($validated['platform'])) {
            return response()->json(['message' => 'Unsupported platform.'], 422);
        }

        $startAt = ! empty($validated['start_date'])
            ? \Carbon\Carbon::createFromFormat('Y-m-d', $validated['start_date'])
            : null;
        $endAt = ! empty($validated['end_date'])
            ? \Carbon\Carbon::createFromFormat('Y-m-d', $validated['end_date'])
            : null;

        $orderId = isset($validated['order_id']) ? trim((string) $validated['order_id']) : null;
        $buyer = isset($validated['buyer']) ? trim((string) $validated['buyer']) : null;
        $productName = isset($validated['product_name']) ? trim((string) $validated['product_name']) : null;
        $orderStatuses = MarketplaceOrderSyncService::resolveStatusFilter(
            isset($validated['order_status']) ? trim((string) $validated['order_status']) : null,
        );

        if (($validated['order_status'] ?? null) && $orderStatuses === []) {
            return response()->json(['message' => 'Unsupported order status filter.'], 422);
        }

        $paginator = $this->orderSync->listOrders(
            $validated['platform'] ?? null,
            $validated['shop_connection_id'] ?? null,
            $orderId !== '' ? $orderId : null,
            $buyer !== '' ? $buyer : null,
            $productName !== '' ? $productName : null,
            $validated['per_page'] ?? 20,
            $validated['page'] ?? 1,
            $startAt,
            $endAt,
            $orderStatuses,
        );

        $stats = $this->orderSync->orderStats(
            $validated['platform'] ?? null,
            $validated['shop_connection_id'] ?? null,
            $orderId !== '' ? $orderId : null,
            $buyer !== '' ? $buyer : null,
            $productName !== '' ? $productName : null,
            $startAt,
            $endAt,
            $orderStatuses,
        );

        return response()->json([
            'data' => MarketplaceOrderResource::collection($paginator->items())->resolve(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
            'stats' => $stats,
        ]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $this->ensurePermission($request->user(), 'orders.view');

        $order = MarketplaceOrder::query()
            ->with('shopConnection')
            ->findOrFail($id);

        return response()->json([
            'data' => new MarketplaceOrderResource($order),
        ]);
    }

    public function export(Request $request): BinaryFileResponse|JsonResponse
    {
        $this->ensurePermission($request->user(), 'orders.view');

        $validated = $request->validate([
            'platform' => ['sometimes', 'nullable', 'string', 'max:32'],
            'shop_connection_id' => ['sometimes', 'nullable', 'integer'],
            'order_id' => ['sometimes', 'nullable', 'string', 'max:64'],
            'buyer' => ['sometimes', 'nullable', 'string', 'max:255'],
            'product_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'order_status' => ['sometimes', 'nullable', 'string', 'max:64'],
            'start_date' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'end_date' => ['sometimes', 'nullable', 'date_format:Y-m-d', 'after_or_equal:start_date'],
        ]);

        if (! empty($validated['platform']) && ! MarketplacePlatform::isValid($validated['platform'])) {
            return response()->json(['message' => 'Unsupported platform.'], 422);
        }

        $startAt = ! empty($validated['start_date'])
            ? \Carbon\Carbon::createFromFormat('Y-m-d', $validated['start_date'])
            : null;
        $endAt = ! empty($validated['end_date'])
            ? \Carbon\Carbon::createFromFormat('Y-m-d', $validated['end_date'])
            : null;

        $orderId = isset($validated['order_id']) ? trim((string) $validated['order_id']) : null;
        $buyer = isset($validated['buyer']) ? trim((string) $validated['buyer']) : null;
        $productName = isset($validated['product_name']) ? trim((string) $validated['product_name']) : null;
        $orderStatuses = MarketplaceOrderSyncService::resolveStatusFilter(
            isset($validated['order_status']) ? trim((string) $validated['order_status']) : null,
        );

        if (($validated['order_status'] ?? null) && $orderStatuses === []) {
            return response()->json(['message' => 'Unsupported order status filter.'], 422);
        }

        $query = $this->orderSync->filteredOrdersForExport(
            $validated['platform'] ?? null,
            $validated['shop_connection_id'] ?? null,
            $orderId !== '' ? $orderId : null,
            $buyer !== '' ? $buyer : null,
            $productName !== '' ? $productName : null,
            $startAt,
            $endAt,
            $orderStatuses,
        );

        $headers = [
            'Platform',
            'Shop',
            'Order ID',
            'Status',
            'Buyer nickname',
            'Buyer name',
            'Buyer phone',
            'Address',
            'City',
            'Postcode',
            'State',
            'Country',
            'Products',
            'Item count',
            'Grand total',
            'Currency',
            'Pay method',
            'Ordered at',
            'Paid at',
            'Contact synced at',
        ];

        $platformLabels = [
            'tiktok_shop' => 'TikTok Shop',
            'shopee' => 'Shopee',
        ];

        $formatter = app(DisplayFormatService::class);

        $rows = (function () use ($query, $platformLabels, $formatter) {
            foreach ($query->cursor() as $order) {
                $addressRaw = is_array($order->buyer_address_raw) ? $order->buyer_address_raw : null;
                $parts = $formatter->parseAddressParts($addressRaw);
                // Fallback when only the flattened string is stored.
                if ($parts['address'] === '' && filled($order->buyer_address)) {
                    $parts['address'] = (string) $order->buyer_address;
                }
                $phone = $formatter->normalizePhone($order->buyer_phone) ?? $order->buyer_phone ?? '';

                yield [
                    $platformLabels[$order->platform] ?? $order->platform,
                    $order->shopConnection?->shop_name ?? '',
                    $order->external_order_id ?? '',
                    $order->order_status_label ?? (string) ($order->order_status ?? ''),
                    $order->buyer_nickname ?? '',
                    $order->buyer_name ?? '',
                    $phone,
                    $parts['address'],
                    $parts['city'],
                    $parts['postcode'],
                    $parts['state'],
                    $parts['country'],
                    $order->product_summary ?? '',
                    $order->item_count ?? 0,
                    $order->grand_total !== null ? (string) $order->grand_total : '',
                    $order->currency ?? '',
                    $order->pay_method ?? '',
                    $order->order_created_at?->format('Y-m-d H:i:s') ?? '',
                    $order->paid_at?->format('Y-m-d H:i:s') ?? '',
                    $order->contact_synced_at?->format('Y-m-d H:i:s') ?? '',
                ];
            }
        })();

        try {
            $path = SimpleXlsxWriter::toTempFile($headers, $rows);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 500);
        }

        $filename = 'marketplace-orders-'.now()->format('Y-m-d-His').'.xlsx';

        return response()->download(
            $path,
            $filename,
            [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ],
        )->deleteFileAfterSend(true);
    }

    public function sync(Request $request): JsonResponse
    {
        $this->ensurePermission($request->user(), 'orders.manage');

        if (function_exists('set_time_limit')) {
            @set_time_limit(600);
        }
        if (function_exists('ini_set')) {
            @ini_set('max_execution_time', '600');
        }

        $validated = $request->validate([
            'shop_connection_id' => ['required', 'integer', 'exists:marketplace_shop_connections,id'],
            'page_size' => ['sometimes', 'integer', 'min:1', 'max:50'],
            'fetch_all' => ['sometimes', 'boolean'],
            'fetch_contacts' => ['sometimes', 'boolean'],
            'fetch_phones' => ['sometimes', 'boolean'],
            'start_date' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'end_date' => ['sometimes', 'nullable', 'date_format:Y-m-d', 'after_or_equal:start_date'],
        ]);

        try {
            $connection = MarketplaceShopConnection::query()
                ->where('is_active', true)
                ->findOrFail($validated['shop_connection_id']);

            if ($connection->platform !== MarketplacePlatform::TIKTOK_SHOP) {
                return response()->json([
                    'message' => 'Order sync is currently available for TikTok Shop shops only.',
                ], 422);
            }

            $startAt = ! empty($validated['start_date'])
                ? \Carbon\Carbon::createFromFormat('Y-m-d', $validated['start_date'])
                : null;
            $endAt = ! empty($validated['end_date'])
                ? \Carbon\Carbon::createFromFormat('Y-m-d', $validated['end_date'])
                : null;

            $result = $this->orderSync->syncConnection(
                $connection,
                $validated['page_size'] ?? 50,
                array_key_exists('fetch_all', $validated) ? (bool) $validated['fetch_all'] : true,
                $startAt,
                $endAt,
                array_key_exists('fetch_contacts', $validated) ? (bool) $validated['fetch_contacts'] : true,
                array_key_exists('fetch_phones', $validated) ? (bool) $validated['fetch_phones'] : false,
            );
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        $created = (int) ($result['created'] ?? 0);
        $updated = (int) ($result['updated'] ?? 0);
        $synced = (int) ($result['synced'] ?? 0);
        $names = (int) ($result['names_revealed'] ?? 0);
        $addresses = (int) ($result['addresses_revealed'] ?? 0);
        $phones = (int) ($result['phones_synced'] ?? 0);
        $unmasked = (int) ($result['unmasked'] ?? ($names + $addresses + $phones));

        $parts = ["Synced {$synced} order(s)"];
        if ($created || $updated) {
            $parts[0] .= " ({$created} new, {$updated} updated)";
        }
        $parts[] = "{$unmasked} unmasked reveal(s)";
        if ($names || $addresses || $phones) {
            $detail = [];
            if ($names) {
                $detail[] = "{$names} name";
            }
            if ($addresses) {
                $detail[] = "{$addresses} address";
            }
            if ($phones) {
                $detail[] = "{$phones} phone";
            }
            $parts[count($parts) - 1] .= ' ('.implode(', ', $detail).')';
        }
        $message = implode(' · ', $parts).'.';

        return response()->json([
            'message' => $message,
            'sync' => $result,
            'shop_connection_id' => $connection->id,
        ]);
    }

    public function revealPhones(Request $request): JsonResponse
    {
        $this->ensurePermission($request->user(), 'orders.manage');

        if (function_exists('set_time_limit')) {
            @set_time_limit(300);
        }
        if (function_exists('ini_set')) {
            @ini_set('max_execution_time', '300');
        }

        $validated = $request->validate([
            'shop_connection_id' => ['required', 'integer', 'exists:marketplace_shop_connections,id'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:30'],
            'start_date' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'end_date' => ['sometimes', 'nullable', 'date_format:Y-m-d', 'after_or_equal:start_date'],
        ]);

        try {
            $connection = MarketplaceShopConnection::query()
                ->where('is_active', true)
                ->findOrFail($validated['shop_connection_id']);

            if ($connection->platform !== MarketplacePlatform::TIKTOK_SHOP) {
                return response()->json([
                    'message' => 'Contact reveal is currently available for TikTok Shop shops only.',
                ], 422);
            }

            $startAt = ! empty($validated['start_date'])
                ? \Carbon\Carbon::createFromFormat('Y-m-d', $validated['start_date'])
                : null;
            $endAt = ! empty($validated['end_date'])
                ? \Carbon\Carbon::createFromFormat('Y-m-d', $validated['end_date'])
                : null;

            $result = $this->orderSync->revealMissingPhones(
                $connection,
                $validated['limit'] ?? 15,
                $startAt,
                $endAt,
            );
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        $message = sprintf(
            'Revealed %d order(s) (name %d, address %d, phone %d)',
            $result['revealed'] ?? 0,
            $result['names_revealed'] ?? 0,
            $result['addresses_revealed'] ?? 0,
            $result['phones_revealed'] ?? $result['revealed'] ?? 0,
        );
        if ($result['attempted']) {
            $message .= " from {$result['attempted']} attempt(s)";
        }
        if (($result['blocked'] ?? 0) > 0) {
            $message .= "; {$result['blocked']} blocked by TikTok (unpaid/canceled/completed)";
        }
        if ($result['remaining'] > 0) {
            $message .= "; {$result['remaining']} still eligible — run again if needed";
        }
        $message .= '.';

        return response()->json([
            'message' => $message,
            'reveal' => $result,
            'shop_connection_id' => $connection->id,
        ]);
    }
}
