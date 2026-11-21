import { useStore } from './store';
/** Pro status and the free limit, for the app's messages and buttons. The database enforces the real limits. */
export function usePlan() {
  const { plan, animals } = useStore();
  const isPro = plan.active && (!plan.expiresAt || Date.parse(plan.expiresAt) > Date.now());
  const remaining = isPro ? Infinity : Math.max(0, plan.freeAnimals - animals.length);
  return { isPro, freeAnimals: plan.freeAnimals, count: animals.length, remaining, expiresAt: plan.expiresAt, productId: plan.productId };
}
