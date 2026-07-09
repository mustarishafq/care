import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ShoppingBag, Store } from 'lucide-react';

import PageHeader from '@/components/layout/PageHeader';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TikTokShop from '@/pages/TikTokShop';
import Shopee from '@/pages/Shopee';

const PLATFORMS = {
  'tiktok-shop': TikTokShop,
  shopee: Shopee,
};

export default function Marketplace() {
  const { platform } = useParams();
  const navigate = useNavigate();

  if (!platform || !PLATFORMS[platform]) {
    return <Navigate to="/marketplace/tiktok-shop" replace />;
  }

  const PlatformView = PLATFORMS[platform];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ShoppingBag}
        title="Marketplace"
        description="Connect TikTok Shop and Shopee seller accounts"
      />

      <Tabs value={platform} onValueChange={(value) => navigate(`/marketplace/${value}`)}>
        <TabsList>
          <TabsTrigger value="tiktok-shop" className="gap-1.5">
            <ShoppingBag className="w-3.5 h-3.5" />
            TikTok Shop
          </TabsTrigger>
          <TabsTrigger value="shopee" className="gap-1.5">
            <Store className="w-3.5 h-3.5" />
            Shopee
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <PlatformView embedded key={platform} />
    </div>
  );
}
