import { db } from '@/api/db';

import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Store, Link2, Loader2, Package, RefreshCw, Unplug, AlertCircle, Settings2,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import PageHeader from '@/components/layout/PageHeader';
import AnimatedSection from '@/components/layout/AnimatedSection';
import StatCard from '@/components/dashboard/StatCard';
import { toast } from 'sonner';
import { usePermissions } from '@/lib/usePermissions';
import { format } from 'date-fns';

const PLATFORM = 'shopee';

function productTitle(product) {
  return product?.title ?? product?.item_name ?? product?.name ?? product?.id ?? '—';
}

function productStatus(product) {
  return product?.status ?? product?.item_status ?? '—';
}

export default function Shopee({ embedded = false } = {}) {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('marketplace.manage');
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('shops');
  const [selectedShopId, setSelectedShopId] = useState('');
  const [productOffset, setProductOffset] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState(null);
  const [refreshingId, setRefreshingId] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingCookieShop, setSavingCookieShop] = useState(false);
  const [cookieShopForm, setCookieShopForm] = useState({
    shop_name: '',
    shop_id: '',
    region: 'MY',
    cookie: '',
  });
  const [cookieDrafts, setCookieDrafts] = useState({});
  const [settingsForm, setSettingsForm] = useState({
    app_key: '',
    app_secret: '',
    region: 'MY',
    use_sandbox: false,
    auto_complaint_enabled: false,
    auto_complaint_max_rating: 3,
    auto_complaint_type_id: '',
    webhook_secret: '',
  });

  const { data: status, isLoading: loadingStatus } = useQuery({
    queryKey: ['shopee-status'],
    queryFn: () => db.integrations.Shopee.getStatus(),
  });

  const { data: platformConfig, isLoading: loadingPlatform } = useQuery({
    queryKey: ['marketplace-platform-config', PLATFORM],
    queryFn: () => db.integrations.Shopee.getPlatformConfig(PLATFORM),
  });

  const { data: connections = [], isLoading: loadingConnections, refetch: refetchConnections } = useQuery({
    queryKey: ['shopee-connections'],
    queryFn: () => db.integrations.Shopee.listConnections(),
  });

  const { data: complaintTypes = [] } = useQuery({
    queryKey: ['complaint-types'],
    queryFn: () => db.entities.ComplaintType.list('sort_order', 100),
  });

  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if (connected) {
      toast.success(`Connected ${connected} Shopee shop${connected === '1' ? '' : 's'}.`);
      queryClient.invalidateQueries({ queryKey: ['shopee-connections'] });
      setSearchParams({}, { replace: true });
    }
    if (error) {
      toast.error(decodeURIComponent(error));
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, queryClient]);

  useEffect(() => {
    if (!selectedShopId && connections.length > 0) {
      setSelectedShopId(String(connections[0].id));
    }
  }, [connections, selectedShopId]);

  useEffect(() => {
    const data = platformConfig?.data;
    if (!data) return;
    setSettingsForm((prev) => ({
      ...prev,
      region: data.region ?? 'MY',
      use_sandbox: data.settings?.use_sandbox ?? false,
      auto_complaint_enabled: data.settings?.auto_complaint_enabled ?? false,
      auto_complaint_max_rating: data.settings?.auto_complaint_max_rating ?? 3,
      auto_complaint_type_id: data.settings?.auto_complaint_type_id
        ? String(data.settings.auto_complaint_type_id)
        : '',
      webhook_secret: '',
    }));
    setCookieShopForm((prev) => ({ ...prev, region: data.region ?? 'MY' }));
  }, [platformConfig]);

  const selectedShop = useMemo(
    () => connections.find((shop) => String(shop.id) === String(selectedShopId)),
    [connections, selectedShopId],
  );

  const { data: productsData, isLoading: loadingProducts, refetch: refetchProducts } = useQuery({
    queryKey: ['shopee-products', selectedShopId, productOffset],
    queryFn: () => db.integrations.Shopee.listProducts(selectedShopId, {
      page_size: 20,
      offset: productOffset,
    }),
    enabled: Boolean(selectedShopId) && activeTab === 'products',
  });

  const products = productsData?.products ?? [];
  const configData = platformConfig?.data;

  const connectShop = async () => {
    setConnecting(true);
    try {
      const { url } = await db.integrations.Shopee.getAuthUrl();
      window.location.href = url;
    } catch (error) {
      toast.error(error.message || 'Failed to start Shopee authorization');
      setConnecting(false);
    }
  };

  const disconnectShop = async (id) => {
    setDisconnectingId(id);
    try {
      await db.integrations.Shopee.disconnect(id);
      await refetchConnections();
      if (String(selectedShopId) === String(id)) setSelectedShopId('');
      toast.success('Shop disconnected');
    } catch (error) {
      toast.error(error.message || 'Failed to disconnect shop');
    } finally {
      setDisconnectingId(null);
    }
  };

  const refreshShopToken = async (id) => {
    setRefreshingId(id);
    try {
      await db.integrations.Shopee.refreshToken(id);
      await refetchConnections();
      toast.success('Token refreshed');
    } catch (error) {
      toast.error(error.message || 'Failed to refresh token');
    } finally {
      setRefreshingId(null);
    }
  };

  const addCookieShop = async () => {
    if (!cookieShopForm.cookie.trim()) {
      toast.error('Paste a Seller Center cookie');
      return;
    }
    setSavingCookieShop(true);
    try {
      await db.integrations.Shopee.addCookieShop({
        cookie: cookieShopForm.cookie.trim(),
        shop_name: cookieShopForm.shop_name.trim() || undefined,
        shop_id: cookieShopForm.shop_id.trim() || undefined,
        region: cookieShopForm.region.trim() || 'MY',
      });
      setCookieShopForm((prev) => ({ ...prev, shop_name: '', shop_id: '', cookie: '' }));
      await refetchConnections();
      await queryClient.invalidateQueries({ queryKey: ['marketplace-shops'] });
      toast.success('Shop cookie saved');
    } catch (error) {
      toast.error(error.message || 'Failed to save shop cookie');
    } finally {
      setSavingCookieShop(false);
    }
  };

  const updateShopCookie = async (id) => {
    const cookie = (cookieDrafts[id] || '').trim();
    if (!cookie) {
      toast.error('Paste a new cookie for this shop');
      return;
    }
    setSavingCookieShop(true);
    try {
      await db.integrations.Shopee.updateCookieShop(id, { cookie });
      setCookieDrafts((prev) => ({ ...prev, [id]: '' }));
      await refetchConnections();
      await queryClient.invalidateQueries({ queryKey: ['marketplace-shops'] });
      toast.success('Shop cookie updated');
    } catch (error) {
      toast.error(error.message || 'Failed to update shop cookie');
    } finally {
      setSavingCookieShop(false);
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const payload = {
        region: settingsForm.region,
        settings: {
          use_sandbox: settingsForm.use_sandbox,
          auto_complaint_enabled: settingsForm.auto_complaint_enabled,
          auto_complaint_max_rating: Number(settingsForm.auto_complaint_max_rating),
          auto_complaint_type_id: settingsForm.auto_complaint_type_id
            ? Number(settingsForm.auto_complaint_type_id)
            : null,
          ...(settingsForm.webhook_secret ? { webhook_secret: settingsForm.webhook_secret } : {}),
        },
      };
      if (settingsForm.app_key.trim()) payload.app_key = settingsForm.app_key.trim();
      if (settingsForm.app_secret.trim()) payload.app_secret = settingsForm.app_secret.trim();

      await db.integrations.Shopee.updatePlatformConfig(PLATFORM, payload);
      await queryClient.invalidateQueries({ queryKey: ['marketplace-platform-config', PLATFORM] });
      await queryClient.invalidateQueries({ queryKey: ['shopee-status'] });
      setSettingsForm((prev) => ({ ...prev, app_key: '', app_secret: '', webhook_secret: '' }));
      toast.success('Settings saved');
    } catch (error) {
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const shopSelector = connections.length > 0 && (
    <Select value={selectedShopId} onValueChange={(value) => { setSelectedShopId(value); setProductOffset(0); }}>
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="Select shop" />
      </SelectTrigger>
      <SelectContent>
        {connections.map((shop) => (
          <SelectItem key={shop.id} value={String(shop.id)}>
            {shop.shop_name || shop.shop_id}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const connectAction = canManage && activeTab !== 'settings' && activeTab !== 'shops' && (
    <Button onClick={connectShop} disabled={connecting || !status?.configured}>
      {connecting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Link2 className="w-4 h-4 mr-2" />}
      Connect via OAuth
    </Button>
  );

  return (
    <div className="space-y-6">
      {!embedded ? (
        <PageHeader
          icon={Store}
          title="Shopee"
          description="Cookie review sync + optional OAuth product catalog"
          actions={connectAction}
        />
      ) : connectAction ? (
        <div className="flex justify-end">{connectAction}</div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard label="Region" value={loadingStatus ? '…' : (status?.region ?? 'MY')} icon={Store} color="blue" index={0} />
        <StatCard label="Shops" value={loadingConnections ? '…' : connections.length} icon={Store} color="purple" index={1} />
        <StatCard label="API" value={loadingStatus ? '…' : (status?.configured ? 'Ready' : 'Setup needed')} icon={Package} color={status?.configured ? 'success' : 'warning'} index={2} />
        <StatCard label="Token issues" value={loadingStatus ? '…' : (status?.connections_needing_attention ?? 0)} icon={AlertCircle} color="warning" index={3} />
      </div>

      <AnimatedSection delay={0.15}>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="shops">Shops</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5"><Settings2 className="w-3.5 h-3.5" />Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="shops" className="space-y-4 mt-4">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Add shop via Seller Center cookie</CardTitle>
              <CardDescription>
                One cookie per shop. Used for review sync + reply (same flow as TikTok Shop).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-200 space-y-1">
                <p>1. Log into <code className="bg-muted px-1 rounded">seller.shopee.com.my</code> for the shop you want.</p>
                <p>2. Open Shop Rating → DevTools → Network → <code className="bg-muted px-1 rounded">search_shop_rating_comments_new</code> → copy Cookie.</p>
                <p>3. Paste below. Shop ID / name are auto-detected from the session (override if needed).</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Shop name (optional)</Label>
                  <Input
                    placeholder="e.g. Emzi Care Official"
                    value={cookieShopForm.shop_name}
                    onChange={(e) => setCookieShopForm((prev) => ({ ...prev, shop_name: e.target.value }))}
                    disabled={!canManage}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Shop ID (optional)</Label>
                  <Input
                    placeholder="Auto from cookie"
                    value={cookieShopForm.shop_id}
                    onChange={(e) => setCookieShopForm((prev) => ({ ...prev, shop_id: e.target.value }))}
                    disabled={!canManage}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Region</Label>
                  <Input
                    value={cookieShopForm.region}
                    onChange={(e) => setCookieShopForm((prev) => ({ ...prev, region: e.target.value }))}
                    disabled={!canManage}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Cookie header</Label>
                <Textarea
                  className="min-h-[100px] font-mono text-xs"
                  placeholder="Paste full Cookie header value…"
                  value={cookieShopForm.cookie}
                  onChange={(e) => setCookieShopForm((prev) => ({ ...prev, cookie: e.target.value }))}
                  disabled={!canManage}
                />
              </div>
              {canManage && (
                <Button onClick={addCookieShop} disabled={savingCookieShop}>
                  {savingCookieShop ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Add / update shop cookie
                </Button>
              )}
            </CardContent>
          </Card>

          {!loadingStatus && !status?.configured && (
            <Card className="rounded-2xl border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800">
              <CardContent className="pt-4 pb-4 text-sm text-amber-800 dark:text-amber-200">
                Partner credentials in <strong>Settings</strong> are only needed for OAuth product sync — cookie shops work for reviews without them.
              </CardContent>
            </Card>
          )}

          <Card className="rounded-2xl">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base">Shops</CardTitle>
                <CardDescription>Cookie shops for reviews · OAuth shops for products (optional)</CardDescription>
              </div>
              {canManage && status?.configured && (
                <Button size="sm" variant="outline" onClick={connectShop} disabled={connecting}>
                  {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Link2 className="w-3.5 h-3.5 mr-2" />}
                  Connect via OAuth
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {loadingConnections ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
              ) : connections.length === 0 ? (
                <p className="text-sm text-muted-foreground">No shops yet. Add a Seller Center cookie above.</p>
              ) : (
                <div className="space-y-3">
                  {connections.map((shop) => (
                    <div key={shop.id} className="rounded-lg border p-3 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium">{shop.shop_name || `Shop ${shop.shop_id}`}</p>
                            <Badge variant="outline">{shop.region}</Badge>
                            <Badge variant="secondary">
                              {shop.auth_mode === 'seller_cookie' ? 'Cookie' : 'OAuth'}
                            </Badge>
                            {shop.has_seller_cookie && <Badge variant="outline" className="text-emerald-700">Cookie OK</Badge>}
                            {shop.connection_error && <Badge variant="destructive">Issue</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            ID {shop.shop_id}
                            {shop.last_synced_at && ` · Last sync ${format(new Date(shop.last_synced_at), 'dd MMM yyyy HH:mm')}`}
                            {shop.cookie_updated_at && ` · Cookie ${format(new Date(shop.cookie_updated_at), 'dd MMM yyyy HH:mm')}`}
                          </p>
                          {shop.connection_error && (
                            <p className="text-xs text-destructive mt-1">{shop.connection_error}</p>
                          )}
                        </div>
                        {canManage && (
                          <div className="flex items-center gap-2">
                            {shop.auth_mode !== 'seller_cookie' && (
                              <Button size="sm" variant="outline" onClick={() => refreshShopToken(shop.id)} disabled={refreshingId === shop.id}>
                                {refreshingId === shop.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                              </Button>
                            )}
                            <Button size="sm" variant="outline" onClick={() => disconnectShop(shop.id)} disabled={disconnectingId === shop.id}>
                              {disconnectingId === shop.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unplug className="w-3.5 h-3.5" />}
                            </Button>
                          </div>
                        )}
                      </div>
                      {canManage && shop.auth_mode === 'seller_cookie' && (
                        <div className="space-y-2">
                          <Label className="text-xs">Refresh cookie for this shop</Label>
                          <Textarea
                            className="min-h-[72px] font-mono text-xs"
                            placeholder="Paste a fresh Cookie header…"
                            value={cookieDrafts[shop.id] || ''}
                            onChange={(e) => setCookieDrafts((prev) => ({ ...prev, [shop.id]: e.target.value }))}
                          />
                          <Button size="sm" variant="outline" onClick={() => updateShopCookie(shop.id)} disabled={savingCookieShop}>
                            {savingCookieShop ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : null}
                            Update cookie
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="mt-4">
          <Card className="rounded-2xl">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base">Products</CardTitle>
                <CardDescription>Live catalog from Shopee Open API</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {shopSelector}
                <Button size="sm" variant="outline" onClick={() => { setProductOffset(0); refetchProducts(); }} disabled={!selectedShopId || loadingProducts}>
                  {loadingProducts ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!selectedShop ? (
                <p className="text-sm text-muted-foreground">Connect a shop first.</p>
              ) : loadingProducts ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading products…</div>
              ) : products.length === 0 ? (
                <p className="text-sm text-muted-foreground">No products returned.</p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">ID</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((product) => (
                        <TableRow key={product.id ?? product.item_id}>
                          <TableCell className="font-medium">{productTitle(product)}</TableCell>
                          <TableCell><Badge variant="secondary">{productStatus(product)}</Badge></TableCell>
                          <TableCell className="text-right font-mono text-xs">{product.id ?? product.item_id}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex justify-between items-center mt-4">
                    <p className="text-xs text-muted-foreground">
                      {productsData?.total_count != null ? `${productsData.total_count} total` : `${products.length} shown`}
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" disabled={productOffset === 0} onClick={() => setProductOffset(0)}>First page</Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!productsData?.has_next_page}
                        onClick={() => setProductOffset(productsData?.next_offset ?? productOffset + 20)}
                      >
                        Next page
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-4 space-y-4">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Partner credentials</CardTitle>
              <CardDescription>Partner ID and key from Shopee Open Platform — stored in database</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingPlatform ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Partner ID</Label>
                      <Input
                        placeholder={configData?.has_app_key ? 'Saved — enter to replace' : 'From Open Platform'}
                        value={settingsForm.app_key}
                        onChange={(e) => setSettingsForm((prev) => ({ ...prev, app_key: e.target.value }))}
                        disabled={!canManage}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Partner key</Label>
                      <Input
                        type="password"
                        placeholder={configData?.has_app_secret ? 'Saved — enter to replace' : 'From Open Platform'}
                        value={settingsForm.app_secret}
                        onChange={(e) => setSettingsForm((prev) => ({ ...prev, app_secret: e.target.value }))}
                        disabled={!canManage}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Region</Label>
                      <Input
                        value={settingsForm.region}
                        onChange={(e) => setSettingsForm((prev) => ({ ...prev, region: e.target.value }))}
                        disabled={!canManage}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">Sandbox mode</p>
                      <p className="text-xs text-muted-foreground">Use Shopee test environment for development</p>
                    </div>
                    <Switch
                      checked={settingsForm.use_sandbox}
                      onCheckedChange={(checked) => setSettingsForm((prev) => ({ ...prev, use_sandbox: checked }))}
                      disabled={!canManage}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>OAuth callback: <code className="bg-muted px-1 rounded break-all">{configData?.callback_url}</code></p>
                    <p>Webhook URL: <code className="bg-muted px-1 rounded break-all">{configData?.webhook_url}</code></p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Care bridge</CardTitle>
              <CardDescription>Auto-create complaints when syncing reviews from Marketplace Reviews</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Auto-create complaint</p>
                  <p className="text-xs text-muted-foreground">When enabled, syncing in <strong>Marketplace Reviews</strong> creates a Care ticket for low ratings.</p>
                </div>
                <Switch
                  checked={settingsForm.auto_complaint_enabled}
                  onCheckedChange={(checked) => setSettingsForm((prev) => ({ ...prev, auto_complaint_enabled: checked }))}
                  disabled={!canManage}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Max rating to trigger (1–5)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    value={settingsForm.auto_complaint_max_rating}
                    onChange={(e) => setSettingsForm((prev) => ({ ...prev, auto_complaint_max_rating: e.target.value }))}
                    disabled={!canManage || !settingsForm.auto_complaint_enabled}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Complaint type</Label>
                  <Select
                    value={settingsForm.auto_complaint_type_id || 'default'}
                    onValueChange={(value) => setSettingsForm((prev) => ({
                      ...prev,
                      auto_complaint_type_id: value === 'default' ? '' : value,
                    }))}
                    disabled={!canManage || !settingsForm.auto_complaint_enabled}
                  >
                    <SelectTrigger><SelectValue placeholder="Default (Other)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default (Other)</SelectItem>
                      {complaintTypes.map((type) => (
                        <SelectItem key={type.id} value={String(type.id)}>{type.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Webhook secret (optional)</Label>
                <Input
                  type="password"
                  placeholder={configData?.settings?.webhook_secret ? 'Saved — enter to replace' : 'Validate incoming Shopee webhooks'}
                  value={settingsForm.webhook_secret}
                  onChange={(e) => setSettingsForm((prev) => ({ ...prev, webhook_secret: e.target.value }))}
                  disabled={!canManage}
                />
              </div>
              {canManage && (
                <Button onClick={saveSettings} disabled={savingSettings}>
                  {savingSettings ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Save settings
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </AnimatedSection>
    </div>
  );
}
