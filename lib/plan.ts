import { useStore } from './store';
/** Pro status and the free limit, for the app's messages and buttons. The database enforces the real limits. */
export function usePlan() {
  const { plan, animals } = useStore();
  const isPro = plan.active && (!plan.expiresAt || Date.parse(plan.expiresAt) > Date.now());
  const owned = animals.filter(a => a.status !== 'Sold').length; // Sold animals don't count towards the free limit
  const remaining = isPro ? Infinity : Math.max(0, plan.freeAnimals - owned);
  return { isPro, freeAnimals: plan.freeAnimals, count: owned, remaining, expiresAt: plan.expiresAt, productId: plan.productId };
}
