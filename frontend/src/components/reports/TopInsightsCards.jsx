import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

function RankList({ items, colorClass }) {
  if (!items.length) {
    return <p className="text-sm text-muted-foreground text-center py-6">No data</p>;
  }
  const max = items[0].count;
  return (
    <div className="space-y-2">
      {items.map((item, i) => {
        const pct = max > 0 ? (item.count / max) * 100 : 0;
        const total = items.reduce((s, x) => s + x.count, 0);
        const share = total > 0 ? ((item.count / total) * 100).toFixed(0) : 0;
        return (
          <div key={item.name} className="group">
            <div className="flex items-center justify-between text-sm mb-1">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                  {i + 1}
                </span>
                <span className="font-medium truncate max-w-[160px]" title={item.name}>{item.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className="font-semibold">{item.count}</span>
                <span className="text-xs text-muted-foreground w-8 text-right">{share}%</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function TopInsightsCards({ complaints }) {
  // Top Complaint Types
  const typeMap = {};
  complaints.forEach(c => {
    if (c.complaint_type) typeMap[c.complaint_type] = (typeMap[c.complaint_type] || 0) + 1;
  });
  const topTypes = Object.entries(typeMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Most Problematic Products
  const productMap = {};
  complaints.forEach(c => {
    if (c.product_name) productMap[c.product_name] = (productMap[c.product_name] || 0) + 1;
  });
  const topProducts = Object.entries(productMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Most Problematic Couriers
  const courierMap = {};
  complaints.forEach(c => {
    if (c.courier_name) courierMap[c.courier_name] = (courierMap[c.courier_name] || 0) + 1;
  });
  const topCouriers = Object.entries(courierMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Top Complaint Types</CardTitle>
        </CardHeader>
        <CardContent>
          <RankList items={topTypes} colorClass="bg-blue-500" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Most Problematic Products</CardTitle>
        </CardHeader>
        <CardContent>
          <RankList items={topProducts} colorClass="bg-amber-500" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Most Problematic Couriers</CardTitle>
        </CardHeader>
        <CardContent>
          <RankList items={topCouriers} colorClass="bg-purple-500" />
        </CardContent>
      </Card>
    </div>
  );
}