import { createRouter, createWebHistory, type RouterHistory, type RouteRecordRaw } from 'vue-router'
import { hasAnyRole, useAuth } from '@/composables/useAuth'
import { openAuthDialog } from '@/composables/useAuthDialog'

export const routes: RouteRecordRaw[] = [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
    },
    {
      path: '/produk/:slug',
      name: 'product-detail',
      component: () => import('@/views/ProductDetailView.vue'),
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
      // Login tampil sebagai dialog di halaman yang sedang dibuka. Tautan
      // lama ke /login tetap bekerja: dialog dibuka lalu URL dibersihkan.
      beforeEnter: (to) => {
        if (typeof window === 'undefined') return true
        openAuthDialog(to.query.redirect)
        return { name: 'home' }
      },
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
      meta: { noindex: true },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
      meta: { noindex: true },
    },
    {
      path: '/admin/login',
      name: 'admin-login',
      component: () => import('@/views/admin/AdminLoginView.vue'),
      meta: { noindex: true },
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
        { path: 'users', name: 'admin-users', component: () => import('@/views/admin/AdminUsersView.vue') },
        { path: 'profile', name: 'admin-profile', component: () => import('@/views/admin/AdminProfileView.vue') },
      ],
    },
]

export function createAppRouter(
  history: RouterHistory = createWebHistory(import.meta.env.BASE_URL),
) {
  const router = createRouter({
    history,
    routes,
    scrollBehavior(to, from, savedPosition) {
      if (savedPosition) return savedPosition
      if (to.hash) return { el: to.hash, top: 88, behavior: 'smooth' }
      // Filter/pencarian hanya mengubah query di halaman yang sama. Jangan
      // lompat ke atas supaya posisi scroll pengguna tetap di daftar produk.
      if (to.path === from.path) return false
      return { top: 0 }
    },
  })

  router.beforeEach(async (to) => {
    const auth = useAuth()

    // 1. Jika sudah login sebagai staf/admin dan membuka /admin/login, langsung ke panel admin.
    if (to.path === '/admin/login') {
      if (auth.accessToken.value) {
        const profile = await auth.fetchProfile()
        if (profile && hasAnyRole(profile, ['admin', 'staff'])) {
          return { name: 'admin-dashboard' }
        }
      }
      return true
    }

    // 2. Proteksi seluruh route area /admin: jika belum login atau bukan admin, arahkan ke /admin/login.
    if (to.path.startsWith('/admin')) {
      if (!auth.accessToken.value) {
        return { path: '/admin/login', query: { redirect: to.fullPath } }
      }
      const profile = await auth.fetchProfile()
      if (!profile || !hasAnyRole(profile, ['admin', 'staff'])) {
        return { path: '/admin/login', query: { redirect: to.fullPath, error: 'unauthorized' } }
      }
      return true
    }

    // 3. Route publik pengguna yang membutuhkan autentikasi (keranjang, checkout, pesanan).
    if (!to.meta.requiresAuth) return true

    const askLogin = () => {
      if (typeof window !== 'undefined') openAuthDialog(to.fullPath)
      return { name: 'home' as const }
    }

    if (!auth.accessToken.value) return askLogin()
    const profile = await auth.fetchProfile()
    const roles = (to.meta.roles as string[] | undefined) || []
    if (!profile) return askLogin()
    if (roles.length > 0 && !hasAnyRole(profile, roles)) return { name: 'home' }
    return true
  })

  return router
}
