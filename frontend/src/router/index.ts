import { createRouter, createWebHistory, type RouterHistory, type RouteRecordRaw } from 'vue-router'
import { hasAnyRole, useAuth } from '@/composables/useAuth'

export const routes: RouteRecordRaw[] = [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
    },
    {
      path: '/keranjang',
      name: 'cart',
      component: () => import('@/views/CartView.vue'),
      meta: { requiresAuth: true, noindex: true },
    },
    {
      path: '/checkout',
      name: 'checkout',
      component: () => import('@/views/CheckoutView.vue'),
      meta: { requiresAuth: true, noindex: true },
    },
    {
      path: '/pesanan',
      name: 'orders',
      component: () => import('@/views/OrdersView.vue'),
      meta: { requiresAuth: true, noindex: true },
    },
    {
      path: '/pesanan/:id',
      name: 'order-detail',
      component: () => import('@/views/OrderDetailView.vue'),
      meta: { requiresAuth: true, noindex: true },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { noindex: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/views/RegisterView.vue'),
      meta: { noindex: true },
    },
    {
      path: '/cari',
      name: 'search',
      component: () => import('@/views/SearchView.vue'),
    },
    {
      path: '/500',
      name: 'server-error',
      component: () => import('@/views/ServerErrorView.vue'),
      props: true,
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
    },
    {
      path: '/admin',
      component: () => import('@/components/admin/AdminLayout.vue'),
      meta: { requiresAuth: true, roles: ['admin', 'staff'], noindex: true },
      children: [
        { path: '', name: 'admin-dashboard', component: () => import('@/views/admin/AdminDashboardView.vue') },
        { path: 'orders', name: 'admin-orders', component: () => import('@/views/admin/AdminOrdersView.vue') },
        { path: 'products', name: 'admin-products', component: () => import('@/views/admin/AdminProductsView.vue') },
        { path: 'categories', name: 'admin-categories', component: () => import('@/views/admin/AdminCategoriesView.vue') },
        { path: 'pos', name: 'admin-pos', component: () => import('@/views/admin/AdminPosView.vue') },
        { path: 'revenue', name: 'admin-revenue', component: () => import('@/views/admin/AdminRevenueView.vue') },
      ],
    },
]

export function createAppRouter(
  history: RouterHistory = createWebHistory(import.meta.env.BASE_URL),
) {
  const router = createRouter({
    history,
    routes,
    scrollBehavior(to, _from, savedPosition) {
      if (savedPosition) return savedPosition
      if (to.hash) return { el: to.hash, top: 88, behavior: 'smooth' }
      return { top: 0 }
    },
  })

  router.beforeEach(async (to) => {
    if (!to.meta.requiresAuth) return true
    const auth = useAuth()
    if (!auth.accessToken.value) return { name: 'login', query: { redirect: to.fullPath } }
    // Always ask the backend for the current role; the database is authoritative.
    const profile = await auth.fetchProfile()
    const roles = (to.meta.roles as string[] | undefined) || []
    if (!profile) return { name: 'login', query: { redirect: to.fullPath } }
    if (!hasAnyRole(profile, roles)) return { name: 'home' }
    return true
  })

  return router
}
