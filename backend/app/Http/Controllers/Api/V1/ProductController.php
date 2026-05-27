<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AppliesEntityQueries;
use App\Http\Controllers\Concerns\AuthorizesPermissions;
use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ProductController extends Controller
{
    use AppliesEntityQueries, AuthorizesPermissions;

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->ensurePermission($request->user(), 'products.view');

        $query = Product::query()->with('category');
        $this->applyFilters($query, $request->except(['sort', 'limit']));
        $this->applySort($query, $request->query('sort', 'name'));

        if ($limit = $request->integer('limit')) {
            $query->limit($limit);
        }

        return ProductResource::collection($query->get());
    }

    public function store(Request $request): ProductResource
    {
        $this->ensurePermission($request->user(), 'products.manage');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'sku' => ['nullable', 'string', 'max:255'],
            'category_id' => ['nullable', 'integer', 'exists:product_categories,id'],
            'description' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        return new ProductResource(Product::create($data)->load('category'));
    }

    public function update(Request $request, string $id): ProductResource
    {
        $this->ensurePermission($request->user(), 'products.manage');

        $product = Product::findOrFail($id);
        $product->update($request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'sku' => ['nullable', 'string', 'max:255'],
            'category_id' => ['nullable', 'integer', 'exists:product_categories,id'],
            'description' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
        ]));

        return new ProductResource($product->fresh()->load('category'));
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $this->ensurePermission($request->user(), 'products.manage');

        Product::findOrFail($id)->delete();

        return response()->json(['message' => 'Deleted successfully.']);
    }
}
