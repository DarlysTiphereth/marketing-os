import {CreativeCampaign, OrderAttribution, PerformanceEvent, type CampaignT, type OrderT, type EventT} from './contracts.ts';

function assertContext(c: CampaignT, x: OrderT | EventT) {
  for (const k of ['account_id', 'commerce_type', 'brand_id', 'product_id', 'shop_id', 'market_id', 'platform_id',
    'language', 'currency', 'campaign_id', 'evidence'] as const) if (x[k] !== c[k]) throw new Error('ATTRIBUTION_ISOLATION');
  if (!['discovery', 'features', 'catalog'].map(f => `${c.campaign_id}-${f}`).includes(x.creative_id)) throw new Error('CREATIVE_ISOLATION');
  if ('listing_id' in x && x.listing_id !== c.listing_id) throw new Error('LISTING_ISOLATION');
}
const sum = (xs: number[]) => {
  const n = xs.reduce((a, b) => a + BigInt(b), 0n);
  if (n > BigInt(Number.MAX_SAFE_INTEGER) || n < BigInt(Number.MIN_SAFE_INTEGER)) throw new Error('MONEY_OVERFLOW');
  return Number(n);
};
const knownSum = (xs: (number | null)[]) => xs.length && xs.every(x => x !== null) ? sum(xs as number[]) : null;
export function performanceReport(c: CampaignT, rawOrders: OrderT[], rawEvents: EventT[]) {
  c = CreativeCampaign.parse(c);
  const orders = rawOrders.map(x => OrderAttribution.parse(x));
  const events = rawEvents.map(x => PerformanceEvent.parse(x));
  [...orders, ...events].forEach(x => assertContext(c, x));
  // Require one current order snapshot; conflicting/repeated imports must be reconciled before accounting.
  if (new Set(orders.map(x => x.order_id)).size !== orders.length) throw new Error('DUPLICATE_ORDER');
  if (new Set(events.map(x => x.event_id)).size !== events.length) throw new Error('DUPLICATE_EVENT');
  const confirmed = orders.filter(x => x.status === 'CONFIRMED');
  const cancelled = orders.filter(x => x.status === 'CANCELLED');
  const seller = confirmed.filter((x): x is Extract<OrderT, {commerce_type: 'SELLER'}> => x.commerce_type === 'SELLER');
  const affiliate = confirmed.filter((x): x is Extract<OrderT, {commerce_type: 'AFFILIATE'}> => x.commerce_type === 'AFFILIATE');
  const net = knownSum(seller.map(x => x.net_revenue === null ? null : x.net_revenue - x.refund));
  const costs = knownSum(seller.map(x => x.cost));
  // Events are cumulative snapshots per creative, not additive increments.
  const latest = new Map<string, EventT>();
  for (const e of events) {
    const previous = latest.get(e.creative_id);
    if (previous?.observed_at === e.observed_at) throw new Error('AMBIGUOUS_SNAPSHOT');
    if (!previous || Date.parse(e.observed_at) > Date.parse(previous.observed_at)) latest.set(e.creative_id, e);
  }
  return {campaign_id: c.campaign_id, account_id: c.account_id, brand_id: c.brand_id, product_id: c.product_id,
    market_id: c.market_id, language: c.language, channel: c.platform_id, commerce_type: c.commerce_type,
    currency: c.currency, evidence: c.evidence, observation_status: orders.length || events.length ? 'OBSERVED' : 'NO_OBSERVATIONS',
    seller: c.commerce_type === 'SELLER' ? {gmv: orders.length ? sum(seller.map(x => x.gmv)) : null,
      orders: orders.length ? seller.length : null, net_revenue: net,
      margin: net !== null && costs !== null ? sum([net, -costs]) : null,
      returns: orders.length ? sum(orders.filter((x): x is Extract<OrderT, {commerce_type: 'SELLER'}> => x.commerce_type === 'SELLER').map(x => x.refund)) : null} : null,
    affiliate: c.commerce_type === 'AFFILIATE' ? {attributed_gmv: orders.length ? sum(affiliate.map(x => x.gmv)) : null,
      confirmed_commissions: orders.length ? sum(affiliate.map(x => x.commission)) : null,
      pending_commissions: orders.length ? sum(orders.filter(x => x.commerce_type === 'AFFILIATE' && x.status === 'PENDING').map(x => x.commission!)) : null,
      cancelled_orders: orders.length ? cancelled.length : null} : null,
    creative: [...latest.values()].map(e => ({creative_id: e.creative_id, views: e.views, clicks: e.clicks,
      retention: e.retention, conversions: e.conversions,
      ctr: e.views && e.clicks !== null ? e.clicks / e.views : null,
      conversion_rate: e.clicks && e.conversions !== null ? e.conversions / e.clicks : null,
      validation_status: 'NOT_VALIDATED_BY_CONTROLLED_EXPERIMENT'})),
  };
}
export function dashboardHtml(reports: ReturnType<typeof performanceReport>[]): string {
  const data = JSON.stringify(reports).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Marketing OS — Commerce</title>
<style>body{font:16px system-ui;background:#f4f7fa;color:#152033;margin:32px}select{padding:8px;margin:8px}article{background:white;padding:24px;margin:16px 0;border-radius:12px}pre{white-space:pre-wrap}small{color:#4a5968}</style>
<h1>Commerce · Previews e observações</h1><p>MOCK é simulação. UNKNOWN não é zero. Nenhum criativo foi validado por vendas.</p>
<div id="filters"></div><main id="cards"></main><script>
const reports=${data};const keys=['brand_id','product_id','market_id','language','channel','campaign_id','commerce_type'];
const filters=document.getElementById('filters');const selections={};
for(const key of keys){const label=document.createElement('label');label.textContent=key;const select=document.createElement('select');
for(const v of ['',...new Set(reports.map(r=>r[key]))]){const option=document.createElement('option');option.value=v;option.textContent=v||'Todos';select.append(option)}
select.onchange=()=>{selections[key]=select.value;render()};label.append(select);filters.append(label)}
function render(){const cards=document.getElementById('cards');cards.replaceChildren();for(const r of reports.filter(r=>keys.every(k=>!selections[k]||r[k]===selections[k]))){
const a=document.createElement('article');const h=document.createElement('h2');h.textContent=r.campaign_id+' · '+r.commerce_type+' · '+r.evidence;
const p=document.createElement('pre');p.textContent=JSON.stringify(r,null,2);a.append(h,p);cards.append(a)}}render();
</script></html>`;
}
