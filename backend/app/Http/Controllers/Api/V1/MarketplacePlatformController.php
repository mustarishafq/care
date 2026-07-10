<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AuthorizesPermissions;
use App\Http\Controllers\Controller;
use App\Http\Resources\MarketplacePlatformConfigResource;
use App\Services\Marketplace\MarketplacePlatformConfigService;
use App\Support\MarketplacePlatform;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MarketplacePlatformController extends Controller
{
    use AuthorizesPermissions;

    public function __construct(
        private readonly MarketplacePlatformConfigService $platformConfig,
    ) {}

    public function show(Request $request, string $platform): JsonResponse
    {
        $this->ensurePermission($request->user(), 'marketplace.view');
        $this->assertPlatform($platform);

        $config = $this->platformConfig->getOrCreate($platform);
        $canManage = $request->user()->hasPermission('marketplace.manage');

        return response()->json([
            'data' => (new MarketplacePlatformConfigResource($config))->additional([
                'can_manage' => $canManage,
                'label' => MarketplacePlatform::label($platform),
                'callback_url' => MarketplacePlatform::oauthCallbackUrl($platform),
                'webhook_url' => MarketplacePlatform::webhookUrl($platform),
            ]),
            'configured' => $this->platformConfig->isConfigured($platform),
        ]);
    }

    public function update(Request $request, string $platform): JsonResponse
    {
        $this->ensurePermission($request->user(), 'marketplace.manage');
        $this->assertPlatform($platform);

        $data = $request->validate([
            'app_key' => ['sometimes', 'nullable', 'string', 'max:255'],
            'app_secret' => ['sometimes', 'nullable', 'string', 'max:255'],
            'service_id' => ['sometimes', 'nullable', 'string', 'max:255'],
            'region' => ['sometimes', 'string', 'max:8'],
            'is_active' => ['sometimes', 'boolean'],
            'settings' => ['sometimes', 'array'],
            'settings.auto_complaint_enabled' => ['sometimes', 'boolean'],
            'settings.auto_complaint_max_rating' => ['sometimes', 'integer', 'min:1', 'max:5'],
            'settings.auto_complaint_type_id' => ['sometimes', 'nullable', 'integer', 'exists:complaint_types,id'],
            'settings.webhook_secret' => ['sometimes', 'nullable', 'string', 'max:255'],
            'settings.use_sandbox' => ['sometimes', 'boolean'],
        ]);

        $config = $this->platformConfig->update($platform, $data, $request->user()->id);

        return response()->json([
            'message' => 'Marketplace platform settings saved.',
            'data' => (new MarketplacePlatformConfigResource($config))->additional([
                'can_manage' => true,
                'label' => MarketplacePlatform::label($platform),
                'callback_url' => MarketplacePlatform::oauthCallbackUrl($platform),
                'webhook_url' => MarketplacePlatform::webhookUrl($platform),
            ]),
            'configured' => $this->platformConfig->isConfigured($platform),
        ]);
    }

    private function assertPlatform(string $platform): void
    {
        if (! MarketplacePlatform::isValid($platform)) {
            abort(404, 'Unsupported marketplace platform.');
        }
    }
}
