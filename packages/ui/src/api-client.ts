// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
/**
 * 🥝 Kiwi API Client
 *
 * Centralized API client for all frontend apps
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface RequestOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  /** Timeout en ms (default 25000). Sin esto, un API dormido = spinner eterno. */
  timeout?: number;
}

// Render (plan gratuito) duerme el API por inactividad: el cold start tarda
// hasta ~60s. 25s evita cuelgues eternos sin cortar un cold start normal.
const DEFAULT_TIMEOUT_MS = 25000;

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;
  private refreshToken: string | null = null;
  /** Vuelo único de refresh: los 401 concurrentes comparten el intento. */
  private refreshFlight: Promise<boolean> | null = null;
  /**
   * Handler de sesión muerta por app. Si la app lo registra, ella decide
   * (ej. cliente: solo redirige en rutas protegidas; home/menu/tracking
   * siguen funcionando sin sesión). Sin handler = redirect duro a /login
   * (comportamiento legacy para driver/web).
   */
  private unauthorizedHandler: ((path: string) => void) | null = null;

  /** La app registra cómo reaccionar a un 401 con refresh muerto. */
  onUnauthorized(handler: ((path: string) => void) | null) {
    this.unauthorizedHandler = handler;
  }

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    // Load token from localStorage if available
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('kiwi_token');
      this.refreshToken = localStorage.getItem('kiwi_refresh_token');
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('kiwi_token', token);
      } else {
        localStorage.removeItem('kiwi_token');
      }
    }
  }

  getToken(): string | null {
    if (typeof window !== 'undefined' && !this.token) {
      this.token = localStorage.getItem('kiwi_token');
    }
    return this.token;
  }

  setRefreshToken(token: string | null) {
    this.refreshToken = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('kiwi_refresh_token', token);
      } else {
        localStorage.removeItem('kiwi_refresh_token');
      }
    }
  }

  getRefreshToken(): string | null {
    if (typeof window !== 'undefined' && !this.refreshToken) {
      this.refreshToken = localStorage.getItem('kiwi_refresh_token');
    }
    return this.refreshToken;
  }

  /**
   * Renueva la sesión con el refresh rotativo (un solo vuelo compartido).
   * Devuelve true si hay access nuevo. False = login de nuevo.
   * Público para que AuthProvider pueda restaurar sesión al arrancar
   * aunque el access falte o esté vencido (sesión de 7 días).
   */
  async restoreSession(): Promise<boolean> {
    return this.refreshSession();
  }

  private refreshSession(): Promise<boolean> {
    if (!this.refreshFlight) {
      this.refreshFlight = (async () => {
        try {
          const rt = this.getRefreshToken();
          if (!rt) return false;
          const res = await fetch(`${this.baseUrl}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: rt }),
          });
          if (!res.ok) return false;
          const data = await res.json();
          if (!data?.accessToken) return false;
          this.setToken(data.accessToken);
          if (data?.refreshToken) this.setRefreshToken(data.refreshToken);
          return true;
        } catch {
          return false;
        } finally {
          this.refreshFlight = null;
        }
      })();
    }
    return this.refreshFlight;
  }

  private async request<T>(
    endpoint: string,
    options: RequestOptions & { _retried?: boolean } = {},
  ): Promise<T> {
    const { method = 'GET', body, headers = {}, timeout = DEFAULT_TIMEOUT_MS } = options;

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    const token = this.getToken();
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new Error('El servidor tardó demasiado. Revisá tu conexión e intentá de nuevo.');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      // Access vencido (7 días) pero con refresh vivo: renovar y reintentar
      // UNA vez antes de mandar a login. Sin esto cada expiración sacaba al
      // usuario aunque su sesión siguiera válida.
      if (
        response.status === 401 &&
        !options._retried &&
        !endpoint.startsWith('/auth/login') &&
        !endpoint.startsWith('/auth/refresh') &&
        !endpoint.startsWith('/auth/register')
      ) {
        const renewed = await this.refreshSession();
        if (renewed) {
          return this.request<T>(endpoint, { ...options, _retried: true });
        }
      }
      // Sesión muerta (refresh vencido/revocado): limpiar y avisar.
      // Se guarda la ruta para volver después. A dónde ir lo decide la app
      // vía onUnauthorized; sin handler se mantiene el redirect a /login.
      if (response.status === 401 && typeof window !== 'undefined') {
        this.setToken(null);
        this.setRefreshToken(null);
        const here = `${window.location.pathname}${window.location.search}`;
        if (!window.location.pathname.includes('/login')) {
          window.sessionStorage.setItem('kiwi_redirect_after_login', here);
          if (this.unauthorizedHandler) {
            try {
              this.unauthorizedHandler(here);
            } catch {
              // la app decide; si su handler falla, no romper el request
            }
          } else {
            window.location.href = '/login';
          }
        }
      }
      const error = await response.json().catch(() => ({ message: 'Error desconocido' }));
      const err: any = new Error(error.message || `Error ${response.status}`);
      err.status = response.status;
      throw err;
    }

    return response.json();
  }

  // ============================================
  // 🔐 AUTH
  // ============================================

  async register(data: {
    email: string;
    password: string;
    phone?: string;
    /** Requerido solo para drivers (nombre público); el backend lo valida por rol. */
    fullName?: string;
    /** Consentimiento explícito marcado en el formulario de registro. */
    acceptedTerms?: boolean;
    role: 'merchant' | 'driver' | 'customer';
    businessName?: string;
    vehicleType?: string;
    citySlug?: string;
    defaultAddress?: string;
    deliveryZone?: string;
    latitude?: number;
    longitude?: number;
  }) {
    const result = await this.request<any>('/auth/register', {
      method: 'POST',
      body: data,
    });
    this.setToken(result.accessToken);
    this.setRefreshToken(result.refreshToken ?? null);
    return result;
  }

  async login(email: string, password: string) {
    const result = await this.request<any>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    this.setToken(result.accessToken);
    this.setRefreshToken(result.refreshToken ?? null);
    return result;
  }

  /** Pide el email de recupero (respuesta siempre igual, exista o no la cuenta). */
  async requestPasswordReset(email: string) {
    return this.request<any>('/auth/forgot-password', {
      method: 'POST',
      body: { email },
    });
  }

  /** Canjea el token del email por una contraseña nueva. */
  async resetPassword(token: string, password: string) {
    return this.request<any>('/auth/reset-password', {
      method: 'POST',
      body: { token, password },
    });
  }

  async getProfile() {
    return this.request<any>('/auth/profile');
  }

  logout() {
    // Revocación global en el server (best-effort) + limpieza local.
    try {
      const token = this.getToken();
      if (token) {
        void fetch(`${this.baseUrl}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => undefined);
      }
    } catch {
      // noop: la limpieza local igual corre
    }
    this.setToken(null);
    this.setRefreshToken(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('kiwi_user');
    }
  }

  // ============================================
  // 👤 USERS
  // ============================================

  async getMe() {
    return this.request<any>('/users/me');
  }

  async updateMe(data: any) {
    return this.request<any>('/users/me', {
      method: 'PUT',
      body: data,
    });
  }

  async getUsersAdmin(params?: {
    role?: string;
    status?: string;
    search?: string;
    take?: number;
    skip?: number;
  }) {
    const q = new URLSearchParams();
    if (params?.role) q.append('role', params.role);
    if (params?.status) q.append('status', params.status);
    if (params?.search) q.append('search', params.search);
    if (params?.take != null) q.append('take', String(params.take));
    if (params?.skip != null) q.append('skip', String(params.skip));
    const qs = q.toString();
    return this.request<any>(`/users${qs ? `?${qs}` : ''}`);
  }

  async setUserStatus(id: string, status: 'active' | 'inactive') {
    return this.request<any>(`/users/${id}/status`, {
      method: 'PUT',
      body: { status },
    });
  }

  /** Fija la contraseña de un usuario (admin). Revoca sus sesiones. */
  async setUserPassword(id: string, password: string) {
    return this.request<any>(`/users/${id}/password`, {
      method: 'PUT',
      body: { password },
    });
  }

  /** Limpia el throttle de login de un usuario (admin). */
  async unlockUserLogin(id: string) {
    return this.request<any>(`/users/${id}/unlock`, { method: 'PUT' });
  }

  /** Activa/apaga cobro con tarjeta/SINPE de un comercio (tras KYC de Onvo). */
  async setMerchantCardPayments(merchantId: string, enabled: boolean) {
    return this.request<any>(`/merchants/${merchantId}/card-payments`, {
      method: 'PUT',
      body: { enabled },
    });
  }

  /** Marca/desmarca un comercio como cocina casera (admin, emprendedores). */
  async setMerchantHomeCook(merchantId: string, enabled: boolean) {
    return this.request<any>(`/merchants/${merchantId}/home-cook`, {
      method: 'PUT',
      body: { enabled },
    });
  }

  async getMarketplaceStatus(): Promise<{ accountId: string | null; status: string | null }> {
    return this.request<any>('/merchants/me/marketplace/status').catch(() => ({
      accountId: null,
      status: null,
    }));
  }

  async startMarketplaceOnboarding(): Promise<{
    accountId: string;
    status: string;
    onboardingUrl?: string;
  }> {
    return this.request<any>('/merchants/me/marketplace/onboarding', { method: 'POST' });
  }

  async regenerateMarketplaceLink(): Promise<{
    accountId: string;
    status?: string;
    onboardingUrl?: string;
  }> {
    return this.request<any>('/merchants/me/marketplace/onboarding-link', { method: 'POST' });
  }

  async listMarketplacePayments(): Promise<Array<{ id: string; amount: number; status: string }>> {
    return this.request<any>('/merchants/me/marketplace/payments');
  }

  // ============================================
  // 🏪 MERCHANTS
  // ============================================

  async discoverMerchants(params?: {
    city?: string;
    q?: string;
    take?: number;
    lat?: number;
    lng?: number;
    category?: string;
  }) {
    const q = new URLSearchParams();
    if (params?.city) q.append('city', params.city);
    if (params?.category) q.append('category', params.category);
    if (params?.q) q.append('q', params.q);
    if (params?.take != null) q.append('take', String(params.take));
    if (params?.lat != null && params?.lng != null) {
      q.append('lat', String(params.lat));
      q.append('lng', String(params.lng));
    }
    const qs = q.toString();
    return this.request<any>(`/merchants/discover${qs ? `?${qs}` : ''}`);
  }

  async getBanners(city = 'nicoya') {
    return this.request<any>(`/ads/banners?city=${encodeURIComponent(city)}`);
  }

  async recordAdEvent(data: {
    campaignId?: string;
    broadcastId?: string;
    type: 'impression' | 'click' | 'push_open';
  }) {
    return this.request<any>('/ads/events', { method: 'POST', body: data });
  }

  async createCustomerOrder(data: any, opts?: { idempotencyKey?: string }) {
    const idempotencyKey = opts?.idempotencyKey || (data as any)?.idempotencyKey;
    return this.request<any>('/orders/mine', {
      method: 'POST',
      body: idempotencyKey ? { ...data, idempotencyKey } : data,
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    });
  }

  async setTopicPreference(topic: string, enabled: boolean) {
    return this.request<any>(`/notifications/topics/${encodeURIComponent(topic)}`, {
      method: 'PUT',
      body: { enabled },
    });
  }

  async getMyCampaigns() {
    return this.request<any>('/ads/my');
  }
  async createCampaign(data: any) {
    return this.request<any>('/ads/campaigns', { method: 'POST', body: data });
  }
  async getMyBroadcasts() {
    return this.request<any>('/offers/my');
  }
  async createBroadcast(data: any) {
    return this.request<any>('/offers', { method: 'POST', body: data });
  }
  async adminListCampaigns(status?: string, city?: string) {
    const q = new URLSearchParams();
    if (status) q.append('status', status);
    if (city) q.append('city', city);
    const qs = q.toString();
    return this.request<any>(`/ads/admin/all${qs ? `?${qs}` : ''}`);
  }
  async reviewCampaign(id: string, approve: boolean) {
    return this.request<any>(`/ads/campaigns/${id}/review`, { method: 'PUT', body: { approve } });
  }
  async reviewBroadcast(id: string, approve: boolean) {
    return this.request<any>(`/offers/${id}/review`, { method: 'PUT', body: { approve } });
  }
  async sendBroadcast(id: string) {
    return this.request<any>(`/offers/${id}/send`, { method: 'POST' });
  }

  async getCustomerProfile() {
    return this.request<any>('/customers/me');
  }

  async updateCustomerProfile(data: any) {
    return this.request<any>('/customers/me', { method: 'PUT', body: data });
  }

  // ============================================
  // 🧡 FOLLOWS (avisos de ventas y stock)
  // ============================================

  /** Comercios que sigo (con mini-perfil para la lista). */
  async getMyFollows(): Promise<
    Array<{
      id: string;
      businessName: string;
      logoUrl: string | null;
      address: string;
      isHomeCook: boolean;
      category: string;
      followedAt: string;
    }>
  > {
    return this.request<any[]>('/follows').catch(() => []);
  }

  /** Seguir un comercio (requiere cuenta de cliente). */
  async followMerchant(merchantId: string): Promise<{ following: boolean }> {
    return this.request<{ following: boolean }>(`/follows/${merchantId}`, { method: 'POST' });
  }

  /** Dejar de seguir un comercio. */
  async unfollowMerchant(merchantId: string): Promise<{ following: boolean }> {
    return this.request<{ following: boolean }>(`/follows/${merchantId}`, { method: 'DELETE' });
  }

  /** Cuántos clientes me siguen (panel del comercio). */
  async getFollowersCount(): Promise<{ count: number }> {
    return this.request<{ count: number }>('/merchants/me/followers').catch(() => ({ count: 0 }));
  }

  /** Avisar a mis seguidores (venta por fecha o stock, máx 3/día). */
  async announceToFollowers(data: { title: string; body: string }): Promise<{ reached: number }> {
    return this.request<{ reached: number }>('/merchants/me/announce', {
      method: 'POST',
      body: data,
    });
  }

  async getMerchantPublicProfile(merchantId: string) {
    return this.request<any>(`/menu/merchant/${merchantId}`);
  }

  async getMerchantMenuItems(merchantId: string, category?: string) {
    const params =
      category && category !== 'Todos' ? `?category=${encodeURIComponent(category)}` : '';
    return this.request<any>(`/menu/merchant/${merchantId}/items${params}`);
  }

  /** Zonas de entrega (DB, editables desde el admin). [] si falla → fallback. */
  async getDeliveryZones() {
    return this.request<any[]>(`/delivery-zones`).catch(() => []);
  }

  // ── Zonas (admin) ────────────────────────────────────────────────
  async adminListZones() {
    return this.request<any[]>(`/delivery-zones/all`);
  }
  async adminCreateZone(body: any) {
    return this.request<any>(`/delivery-zones`, { method: 'POST', body });
  }
  async adminUpdateZone(id: string, body: any) {
    return this.request<any>(`/delivery-zones/${id}`, { method: 'PUT', body });
  }
  async adminDeactivateZone(id: string) {
    return this.request<any>(`/delivery-zones/${id}`, { method: 'DELETE' });
  }

  /** Vitrina de mañana: qué comercios venden mañana (para la preventa). */
  async getTomorrowPreview(city = 'nicoya'): Promise<{
    items: Array<{
      merchantId: string;
      businessName: string;
      logoUrl: string | null;
      isHomeCook: boolean;
      items: Array<{
        id: string;
        name: string;
        price: number;
        image: string | null;
        stockQty: number | null;
        fulfillNote: string | null;
      }>;
    }>;
  }> {
    return this.request<any>(`/menu/tomorrow?city=${encodeURIComponent(city)}`).catch(() => ({
      items: [],
    }));
  }

  async getMyMenuItems() {
    return this.request<any>('/menu/my');
  }

  async createMenuItem(data: any) {
    return this.request<any>('/menu/my', {
      method: 'POST',
      body: data,
    });
  }

  async updateMenuItem(itemId: string, data: any) {
    return this.request<any>(`/menu/my/${itemId}`, {
      method: 'PUT',
      body: data,
    });
  }

  async deleteMenuItem(itemId: string) {
    return this.request<any>(`/menu/my/${itemId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Sube la imagen de un producto (multipart). Devuelve { url } https lista
   * para <img>. El backend valida magic bytes + tamaño; sin credenciales de
   * Cloudinary responde 503 — el form muestra el aviso y el picker de emoji
   * sigue siendo el fallback.
   */
  async uploadMenuImage(file: File): Promise<{ url: string }> {
    const fd = new FormData();
    fd.append('image', file);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      let response = await fetch(`${this.baseUrl}/menu/my/image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.getToken() ?? ''}` },
        body: fd,
        signal: controller.signal,
      });
      if (response.status === 401 && (await this.refreshSession())) {
        response = await fetch(`${this.baseUrl}/menu/my/image`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.getToken() ?? ''}` },
          body: fd,
          signal: controller.signal,
        });
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((data as any)?.message || `Error al subir imagen (${response.status})`);
      }
      return data as { url: string };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new Error('El servidor tardó demasiado. Revisá tu conexión e intentá de nuevo.');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Sube la foto de evidencia de un pedido (multipart `photo` + `kind`).
   * `pickup` la sube el comercio, `delivery` el repartidor asignado.
   * El backend valida magic bytes + 5 MB igual que las imágenes de menú.
   */
  async uploadOrderProofPhoto(
    orderId: string,
    kind: 'pickup' | 'delivery',
    file: File,
  ): Promise<{ url: string }> {
    const fd = new FormData();
    fd.append('photo', file);
    fd.append('kind', kind);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      let response = await fetch(`${this.baseUrl}/orders/${orderId}/proof-photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.getToken() ?? ''}` },
        body: fd,
        signal: controller.signal,
      });
      if (response.status === 401 && (await this.refreshSession())) {
        response = await fetch(`${this.baseUrl}/orders/${orderId}/proof-photo`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.getToken() ?? ''}` },
          body: fd,
          signal: controller.signal,
        });
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((data as any)?.message || `Error al subir foto (${response.status})`);
      }
      return data as { url: string };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new Error('El servidor tardó demasiado. Revisá tu conexión e intentá de nuevo.');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Si la subida de imágenes está configurada (Cloudinary). */
  async getImageUploadStatus(): Promise<{ enabled: boolean }> {
    return this.request<{ enabled: boolean }>('/menu/my/image-status');
  }

  async getMerchantProfile() {
    return this.request<any>('/merchants/me');
  }

  async updateMerchantProfile(data: any) {
    return this.request<any>('/merchants/me', {
      method: 'PUT',
      body: data,
    });
  }

  async setMyVisibility(listed: boolean) {
    return this.request<any>('/merchants/me/visibility', {
      method: 'PUT',
      body: { listed },
    });
  }

  /** Métodos de pago del comercio (efectivo, SINPE). */
  async setMerchantPaymentMethods(body: { cashEnabled?: boolean; sinpeEnabled?: boolean }) {
    return this.request<any>('/merchants/me/payment-methods', {
      method: 'PUT',
      body,
    });
  }

  async getFavoriteDrivers() {
    return this.request<any>('/merchants/me/favorites');
  }

  async addFavoriteDriver(driverId: string) {
    return this.request<any>(`/merchants/me/favorites/${driverId}`, {
      method: 'POST',
    });
  }

  async removeFavoriteDriver(driverId: string) {
    return this.request<any>(`/merchants/me/favorites/${driverId}`, {
      method: 'DELETE',
    });
  }

  // ============================================
  // 🛵 DRIVERS
  // ============================================

  async getDriverProfile() {
    return this.request<any>('/drivers/me');
  }

  async updateDriverProfile(data: any) {
    return this.request<any>('/drivers/me', {
      method: 'PUT',
      body: data,
    });
  }

  /**
   * Sube la foto de perfil del repartidor (multipart `photo`). El backend la
   * guarda en el perfil y devuelve { url } https lista para <img>. Aparece en
   * la app del comercio y en el link de seguimiento del pedido.
   */
  async uploadDriverPhoto(file: File): Promise<{ url: string }> {
    const fd = new FormData();
    fd.append('photo', file);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      let response = await fetch(`${this.baseUrl}/drivers/me/photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.getToken() ?? ''}` },
        body: fd,
        signal: controller.signal,
      });
      if (response.status === 401 && (await this.refreshSession())) {
        response = await fetch(`${this.baseUrl}/drivers/me/photo`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.getToken() ?? ''}` },
          body: fd,
          signal: controller.signal,
        });
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((data as any)?.message || `Error al subir foto (${response.status})`);
      }
      return data as { url: string };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new Error('El servidor tardó demasiado. Revisá tu conexión e intentá de nuevo.');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Si la subida de foto de perfil está configurada (Cloudinary). */
  async getDriverPhotoUploadStatus(): Promise<{ enabled: boolean }> {
    return this.request<{ enabled: boolean }>('/drivers/me/photo-status');
  }

  async getDriverMarketplaceStatus(): Promise<{ accountId: string | null; status: string | null }> {
    return this.request<any>('/drivers/me/marketplace/status').catch(() => ({
      accountId: null,
      status: null,
    }));
  }
  async startDriverMarketplaceOnboarding(): Promise<{
    accountId: string;
    status: string;
    onboardingUrl?: string;
  }> {
    return this.request<any>('/drivers/me/marketplace/onboarding', { method: 'POST' });
  }
  async regenerateDriverMarketplaceLink(): Promise<{
    accountId: string;
    status?: string;
    onboardingUrl?: string;
  }> {
    return this.request<any>('/drivers/me/marketplace/onboarding-link', { method: 'POST' });
  }
  async listDriverMarketplacePayments(): Promise<any[]> {
    return this.request<any[]>('/drivers/me/marketplace/payments').catch(() => []);
  }

  /**
   * Sube el logo del comercio (multipart `photo`). El backend lo guarda en
   * el perfil y devuelve { url }. Se ve en la app cliente (lista y menú).
   */
  async uploadMerchantLogo(file: File): Promise<{ url: string }> {
    const fd = new FormData();
    fd.append('photo', file);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      let response = await fetch(`${this.baseUrl}/merchants/me/logo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.getToken() ?? ''}` },
        body: fd,
        signal: controller.signal,
      });
      if (response.status === 401 && (await this.refreshSession())) {
        response = await fetch(`${this.baseUrl}/merchants/me/logo`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.getToken() ?? ''}` },
          body: fd,
          signal: controller.signal,
        });
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((data as any)?.message || `Error al subir logo (${response.status})`);
      }
      return data as { url: string };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new Error('El servidor tardó demasiado. Revisá tu conexión e intentá de nuevo.');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Si la subida de logo del comercio está configurada (Cloudinary). */
  async getMerchantLogoUploadStatus(): Promise<{ enabled: boolean }> {
    return this.request<{ enabled: boolean }>('/merchants/me/logo-status');
  }

  /**
   * Sube la foto de perfil del cliente (multipart `photo`). El backend la
   * guarda como avatarUrl del perfil y devuelve { url }.
   */
  async uploadCustomerAvatar(file: File): Promise<{ url: string }> {
    const fd = new FormData();
    fd.append('photo', file);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      let response = await fetch(`${this.baseUrl}/customers/me/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.getToken() ?? ''}` },
        body: fd,
        signal: controller.signal,
      });
      if (response.status === 401 && (await this.refreshSession())) {
        response = await fetch(`${this.baseUrl}/customers/me/avatar`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.getToken() ?? ''}` },
          body: fd,
          signal: controller.signal,
        });
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((data as any)?.message || `Error al subir foto (${response.status})`);
      }
      return data as { url: string };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new Error('El servidor tardó demasiado. Revisá tu conexión e intentá de nuevo.');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Si la subida de avatar del cliente está configurada (Cloudinary). */
  async getCustomerAvatarUploadStatus(): Promise<{ enabled: boolean }> {
    return this.request<{ enabled: boolean }>('/customers/me/avatar-status');
  }

  async updateDriverStatus(status: 'offline' | 'available' | 'busy') {
    return this.request<any>('/drivers/me/status', {
      method: 'PUT',
      body: { status },
    });
  }

  async getDriverSchedule() {
    return this.request<any>('/drivers/me/schedule');
  }

  async updateDriverSchedule(schedules: any[]) {
    return this.request<any>('/drivers/me/schedule', {
      method: 'PUT',
      body: schedules,
    });
  }

  async getDriverEarnings(period: string = 'all') {
    return this.request<any>(`/drivers/me/earnings?period=${period}`);
  }

  async getAvailableDrivers(lat?: number, lng?: number) {
    const params = new URLSearchParams();
    if (lat != null) params.append('lat', String(lat));
    if (lng != null) params.append('lng', String(lng));
    return this.request<any>(`/drivers/available?${params.toString()}`);
  }

  async getDriverById(id: string) {
    return this.request<any>(`/drivers/${id}`);
  }

  async updateDriverLocation(lat: number, lng: number, orderId?: string) {
    return this.request<any>('/drivers/me/location', {
      method: 'PUT',
      body: { lat, lng, orderId },
    });
  }

  async getDriverLocation(driverId: string) {
    return this.request<any>(`/drivers/${driverId}/location`);
  }

  // ============================================
  // 📦 ORDERS
  // ============================================

  async createOrder(data: any, opts?: { idempotencyKey?: string }) {
    const idempotencyKey = opts?.idempotencyKey || (data as any)?.idempotencyKey;
    return this.request<any>('/orders', {
      method: 'POST',
      body: idempotencyKey ? { ...data, idempotencyKey } : data,
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    });
  }

  /** Pedido invitado desde el link público del menú (sin cuenta). */
  async createGuestOrder(data: any, opts?: { idempotencyKey?: string }) {
    const idempotencyKey = opts?.idempotencyKey || (data as any)?.idempotencyKey;
    return this.request<any>('/orders/guest', {
      method: 'POST',
      body: idempotencyKey ? { ...data, idempotencyKey } : data,
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    });
  }

  /** Comandas del comercio: pedidos activos entrados por la app cliente. */
  async getIncomingOrders() {
    return this.request<any[]>('/orders/incoming');
  }

  async getMyOrders(status?: string) {
    const params = status ? `?status=${status}` : '';
    return this.request<any>(`/orders/my${params}`);
  }

  async getAvailableOrders(lat?: number, lng?: number) {
    const params = new URLSearchParams();
    if (lat != null) params.append('lat', String(lat));
    if (lng != null) params.append('lng', String(lng));
    return this.request<any>(`/orders/available?${params.toString()}`);
  }

  async getOrderById(id: string) {
    return this.request<any>(`/orders/${id}`);
  }

  async getOrderMessages(orderId: string, limit = 50) {
    return this.request<any>(`/orders/${orderId}/messages?limit=${limit}`);
  }

  async getPublicTracking(orderId: string) {
    return this.request<any>(`/orders/track/${orderId}`);
  }

  async getPublicDriverLocation(orderId: string) {
    return this.request<any>(`/orders/track/${orderId}/location`);
  }

  async updateOrderStatus(orderId: string, status: string) {
    return this.request<any>(`/orders/${orderId}/status`, {
      method: 'PUT',
      body: { status },
    });
  }

  async submitRating(data: {
    orderId: string;
    rating: number;
    comment?: string;
    onTime?: boolean;
    carefulWithOrder?: boolean;
  }) {
    return this.request<any>('/ratings', {
      method: 'POST',
      body: data,
    });
  }

  async getRatingForOrder(orderId: string) {
    return this.request<{ rating: any | null; canRate: boolean }>(`/ratings/order/${orderId}`);
  }

  /** Lookup público para calificar desde el link (invitados). */
  async getPublicRating(orderId: string) {
    return this.request<{ order: any; rating: any | null; canRate: boolean }>(
      `/ratings/public/${orderId}`,
    );
  }

  /** Calificación pública desde el link (invitados, una sola vez). */
  async submitPublicRating(data: {
    orderId: string;
    rating: number;
    comment?: string;
    onTime?: boolean;
    carefulWithOrder?: boolean;
  }) {
    return this.request<any>('/ratings/public', {
      method: 'POST',
      body: data,
    });
  }

  async assignDriver(orderId: string, driverId: string) {
    return this.request<any>(`/orders/${orderId}/assign`, {
      method: 'PUT',
      body: { driverId },
    });
  }

  /** El asignado devuelve el pedido a concurso (avisa al comercio). */
  async rejectOrder(orderId: string) {
    return this.request<any>(`/orders/${orderId}/reject`, {
      method: 'POST',
    });
  }

  async acceptOrder(orderId: string) {
    return this.request<any>(`/orders/${orderId}/accept`, {
      method: 'POST',
    });
  }

  /** El driver asignado acepta dentro de la ventana de aceptación. */
  async acceptAssignment(orderId: string) {
    return this.request<any>(`/orders/${orderId}/accept-assignment`, { method: 'POST' });
  }

  async submitProposal(orderId: string, data: any) {
    return this.request<any>(`/orders/${orderId}/proposals`, {
      method: 'POST',
      body: data,
    });
  }

  async acceptProposal(orderId: string, proposalId: string) {
    return this.request<any>(`/orders/${orderId}/proposals/${proposalId}/accept`, {
      method: 'PUT',
    });
  }

  async getProposals(orderId: string) {
    return this.request<any>(`/orders/${orderId}/proposals`);
  }

  async getScheduledOrders() {
    return this.request<any>('/orders/available?scheduled=true');
  }

  // ============================================
  // 🪪 KYC
  // ============================================

  async getKycStatus() {
    return this.request<any>('/kyc/status');
  }

  async submitKycDocuments(data: any) {
    return this.request<any>('/kyc/submit', {
      method: 'POST',
      body: data,
    });
  }

  /** Inicia verificación Didit hospedada. Devuelve { url, sessionId, status }. */
  async startDiditSession() {
    return this.request<{ url: string; sessionId: string; status: string }>('/kyc/didit/start', {
      method: 'POST',
    });
  }

  /** Pull manual de la decisión Didit (si el webhook se perdió). */
  async refreshDiditSession() {
    return this.request<any>('/kyc/didit/refresh', { method: 'POST' });
  }

  // Admin KYC endpoints
  async getAllKycVerifications(status?: string) {
    const params = status && status !== 'all' ? `?status=${status}` : '';
    return this.request<any>(`/kyc/admin/all${params}`);
  }

  async getPendingKycVerifications() {
    return this.request<any>('/kyc/admin/pending');
  }

  async getKycStats() {
    return this.request<any>('/kyc/admin/stats');
  }

  async getKycById(id: string) {
    return this.request<any>(`/kyc/admin/${id}`);
  }

  async approveKyc(id: string) {
    return this.request<any>(`/kyc/admin/${id}/approve`, {
      method: 'PUT',
    });
  }

  async rejectKyc(id: string, reason: string) {
    return this.request<any>(`/kyc/admin/${id}/reject`, {
      method: 'PUT',
      body: { reason },
    });
  }

  // ============================================
  // 🔔 NOTIFICATIONS
  // ============================================

  async getMyNotifications(unreadOnly = false) {
    const params = new URLSearchParams();
    if (unreadOnly) params.append('unreadOnly', 'true');
    return this.request<any>(`/notifications?${params.toString()}`);
  }

  async getUnreadNotificationCount() {
    return this.request<any>('/notifications/unread-count');
  }

  async markNotificationAsRead(id: string) {
    return this.request<any>(`/notifications/${id}/read`, {
      method: 'PUT',
    });
  }

  async markAllNotificationsAsRead() {
    return this.request<any>('/notifications/read-all', {
      method: 'PUT',
    });
  }

  async deleteNotification(id: string) {
    return this.request<any>(`/notifications/${id}`, {
      method: 'DELETE',
    });
  }

  async registerDeviceToken(token: string, platform: 'ios' | 'android' | 'web') {
    return this.request<any>('/notifications/device-token', {
      method: 'PUT',
      body: { token, platform },
    });
  }

  async removeDeviceToken(token: string) {
    return this.request<any>('/notifications/device-token', {
      method: 'DELETE',
      body: { token },
    });
  }

  /** Push de prueba a mis propios dispositivos (diagnóstico). */
  async sendTestPush() {
    return this.request<{
      fcmConfigured: boolean;
      tokens: number;
      sent: number;
      results: Array<{ token: string; ok: boolean; error?: string }>;
    }>('/notifications/test-push', {
      method: 'POST',
    });
  }

  /** Mis registros push (enmascarados) para diagnosticar duplicados. */
  async getDeviceTokens() {
    return this.request<
      Array<{ short: string; platform: string; lastUsedAt: string; createdAt: string }>
    >('/notifications/device-tokens');
  }

  /** Conserva el registro más nuevo por plataforma, borra el resto. */
  async pruneDeviceTokens() {
    return this.request<{ removed: number; remaining: number }>(
      '/notifications/device-tokens/prune',
      { method: 'POST' },
    );
  }

  /** Catálogo de topics con las preferencias efectivas del usuario. */
  async getNotificationTopics() {
    return this.request<
      Array<{
        name: string;
        label: string;
        description: string;
        enabled: boolean;
        locked: boolean;
        delivery: string;
      }>
    >('/notifications/topics');
  }

  /** Activa/desactiva un topic; el API re-sincroniza FCM. */
  async setNotificationTopic(topic: string, enabled: boolean) {
    return this.request<any>(`/notifications/topics/${encodeURIComponent(topic)}`, {
      method: 'PUT',
      body: { enabled },
    });
  }

  /** Re-sincroniza las suscripciones FCM desde las preferencias. */
  async syncNotificationTopics() {
    return this.request<{ synced: number }>('/notifications/topics/sync', {
      method: 'POST',
    });
  }

  // ============================================
  // 🚦 TRAFFIC NOTIFICATIONS
  // ============================================

  async getTrafficNotificationHistory(limit?: number) {
    const params = new URLSearchParams();
    if (limit) params.append('limit', String(limit));
    return this.request<any>(`/notifications/traffic/history?${params.toString()}`);
  }

  async getTrafficNotificationPreferences() {
    return this.request<any>('/notifications/traffic/preferences');
  }

  async updateTrafficNotificationPreferences(preferences: {
    enabled?: boolean;
    types?: Record<string, boolean>;
    minConfidence?: number;
    trafficLevels?: string[];
    hours?: number[];
    days?: number[];
  }) {
    return this.request<any>('/notifications/traffic/preferences', {
      method: 'PUT',
      body: preferences,
    });
  }

  async subscribeToTrafficPredictions(lat: number, lng: number) {
    return this.request<any>('/notifications/traffic/subscribe', {
      method: 'POST',
      body: { lat, lng },
    });
  }

  async sendTestTrafficNotification(lat: number, lng: number, type: string) {
    return this.request<any>('/notifications/traffic/test', {
      method: 'POST',
      body: { lat, lng, type },
    });
  }

  // ============================================
  // 💳 PAYMENTS
  // ============================================

  async createPayment(
    data: {
      orderId: string;
      method: 'onvopay_card' | 'onvopay_sinpe' | 'crypto' | 'cash' | 'credit';
      amount: number;
      customerEmail?: string;
      customerPhone?: string;
      cryptoCoin?: 'USDC' | 'USDT';
    },
    opts?: { idempotencyKey?: string },
  ) {
    const idempotencyKey = opts?.idempotencyKey;
    return this.request<any>('/payments/create', {
      method: 'POST',
      body: idempotencyKey ? { ...data, idempotencyKey } : data,
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    });
  }

  /** Cobro invitado desde el link público (sin cuenta, sin crédito). */
  async createGuestPayment(
    data: {
      orderId: string;
      method: 'onvopay_card' | 'onvopay_sinpe' | 'crypto' | 'cash';
      amount: number;
      customerEmail?: string;
      customerPhone?: string;
      cryptoCoin?: 'USDC' | 'USDT';
    },
    opts?: { idempotencyKey?: string },
  ) {
    const idempotencyKey = opts?.idempotencyKey;
    return this.request<any>('/payments/guest', {
      method: 'POST',
      body: idempotencyKey ? { ...data, idempotencyKey } : data,
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    });
  }

  async getPaymentStatus(orderId: string) {
    return this.request<any>(`/payments/status/${orderId}`);
  }

  /** Solo si está pagado o no (para el link público, sin montos). */
  async getPublicPaidStatus(orderId: string): Promise<{ paid: boolean }> {
    return this.request<{ paid: boolean }>(`/payments/public-status/${orderId}`);
  }

  async getPaymentMethods() {
    return this.request<any>('/payments/methods');
  }

  async getCryptoQuote(amount: number, coin: 'USDC' | 'USDT') {
    const params = new URLSearchParams({ amount: String(amount), coin });
    return this.request<any>(`/payments/crypto/quote?${params.toString()}`, {
      method: 'GET',
    });
  }

  // ============================================
  // 🔊 ONVO PAY NOTIFICATIONS
  // ============================================

  async getOnvoPaymentStatus(paymentIntentId: string) {
    return this.request<any>(`/payments/onvo/status/${paymentIntentId}`);
  }

  async cancelOnvoPayment(paymentIntentId: string) {
    return this.request<any>(`/payments/onvo/cancel/${paymentIntentId}`, {
      method: 'POST',
    });
  }

  async getOnvoPaymentMethods() {
    return this.request<any>(`/payments/onvo/methods`);
  }

  async refundOnvoPayment(paymentIntentId: string, amount?: number) {
    return this.request<any>(`/payments/onvo/refund/${paymentIntentId}`, {
      method: 'POST',
      body: amount ? { amount } : undefined,
    });
  }

  async getOnvoPaymentIntent(paymentIntentId: string) {
    return this.request<any>(`/payments/onvo/intent/${paymentIntentId}`);
  }

  // ============================================
  // 📊 ANALYTICS
  // ============================================

  async getPlatformAnalytics(period: string = 'week') {
    return this.request<any>(`/analytics/platform?period=${period}`);
  }

  async getMerchantAnalytics(period: string = 'week') {
    return this.request<any>(`/analytics/merchant?period=${period}`);
  }

  async getDriverAnalytics(period: string = 'week') {
    return this.request<any>(`/analytics/driver?period=${period}`);
  }

  async getAnalyticsSummary() {
    return this.request<any>('/analytics/summary');
  }

  // Crédito prepago del comercio (solo envío: viaje + plataforma)
  async getCreditBalance() {
    return this.request<{ merchantId: string; balance: number }>('/credits/balance');
  }

  async getCreditHistory(take = 30, skip = 0) {
    return this.request<any>(`/credits/history?take=${take}&skip=${skip}`);
  }

  /** Recarga de crédito con tarjeta: crea el cobro y devuelve el checkout. */
  async createCreditTopup(amount: number) {
    return this.request<{ topupId: string; amount: number; checkoutUrl: string; status: string }>(
      '/credits/topup',
      { method: 'POST', body: { amount } },
    );
  }

  /** Estado de mi recarga con tarjeta (reconcilia contra Onvo si está pendiente). */
  async getCreditTopup(id: string) {
    return this.request<{
      id: string;
      amount: number;
      currency: string;
      status: string;
      checkoutUrl: string | null;
      balance: number;
      completedAt: string | null;
    }>(`/credits/topup/${id}`);
  }

  async getCreditMerchants() {
    return this.request<any[]>('/credits/admin/merchants');
  }

  async rechargeMerchantCredit(id: string, amount: number, reason?: string) {
    return this.request<any>(`/credits/admin/merchants/${id}/recharge`, {
      method: 'POST',
      body: { amount, reason },
    });
  }

  async refundMerchantCredit(id: string, amount: number, reason?: string) {
    return this.request<any>(`/credits/admin/merchants/${id}/refund`, {
      method: 'POST',
      body: { amount, reason },
    });
  }

  async getMerchantCreditHistory(id: string, take = 30, skip = 0) {
    return this.request<any>(`/credits/admin/merchants/${id}/history?take=${take}&skip=${skip}`);
  }

  // Ajustes de plataforma (admin + disponibilidad pública de pagos)
  async getAdminSettings() {
    return this.request<any>('/settings/admin');
  }

  async saveAdminSettings(data: any) {
    return this.request<any>('/settings/admin', { method: 'PUT', body: data });
  }

  async getPaymentAvailability() {
    return this.request<{ sinpe: boolean; card: boolean; cash: boolean; crypto: boolean }>(
      '/settings/payments',
    );
  }

  /**
   * Mezcla real de zonas de pedidos entregados (admin): pesos % por zona id
   * para el simulador de ganancias.
   */
  async getDeliveredZoneMix(): Promise<{
    delivered: number;
    classified: number;
    unclassified: number;
    zones: Array<{ id: string; count: number; weight: number }>;
    weights: Record<string, number>;
  }> {
    return this.request<any>('/orders/admin/zone-mix');
  }

  /**
   * Ingresos reales por mes de pedidos entregados (admin): base del reporte
   * "Real vs Proyección" del simulador. Los montos son históricos (guardados
   * al crear/entregar cada pedido), no recalculados.
   */
  async getMonthlyActuals(months = 6): Promise<{
    months: number;
    monthly: Array<{
      month: string; // "YYYY-MM"
      trips: number;
      gmv: number; // suma de basePrice del mes
      commission: number; // suma de commission del mes
      avgCommissionRate: number | null; // 0..1, promedio de commissionRate
      tripsByZone: Record<string, number>;
    }>;
    /** Ventana móvil de los últimos 30 días (para ajustar el escenario). */
    last30: {
      trips: number;
      gmv: number;
      commission: number;
      tripsPerDay: number;
      commissionPerDay: number;
    };
  }> {
    return this.request<any>(
      `/orders/admin/monthly-actuals?months=${encodeURIComponent(String(months))}`,
    );
  }

  /**
   * Historial mensual de escenarios fijados (reporte Real vs Proyección):
   * la proyección que el admin dejó sellada al cierre de cada mes.
   */
  async getScenarioHistory(): Promise<
    Array<{
      month: string; // "YYYY-MM"
      ordersPerDay: number;
      expectedTrip: number;
      commissionPct: number;
      operations: {
        fixedMonthlyCost: number;
        supportPerTrip: number;
        gatewayPct: number;
        digitalPct: number;
      };
      projectedCommission: number;
      projectedNet: number;
      note: string | null;
      createdAt: string;
    }>
  > {
    return this.request<any>('/settings/scenario-history');
  }

  /** Fija (o re-fija) el escenario proyectado de un mes. Un snapshot por mes. */
  async saveScenarioSnapshot(input: {
    month: string;
    ordersPerDay: number;
    expectedTrip: number;
    commissionPct: number;
    operations: {
      fixedMonthlyCost: number;
      supportPerTrip: number;
      gatewayPct: number;
      digitalPct: number;
    };
    projectedCommission: number;
    projectedNet: number;
    note?: string | null;
  }) {
    return this.request<any>('/settings/scenario-history', {
      method: 'PUT',
      body: input,
    });
  }

  /** % de comisión del repartidor (público; el backend es fuente de verdad). */
  async getDriverCommissionPct(): Promise<number> {
    try {
      const r = await this.request<any>('/settings/driver-commission');
      const pct = Number(r?.pct);
      if (Number.isFinite(pct)) return Math.min(Math.max(pct, 0), 100);
    } catch {
      // sin red o backend viejo: default
    }
    return 15;
  }

  /**
   * Tasas del cargo por servicio (extra sobre productos: standard 15%,
   * cocina casera 10%). El backend cobra el total real; esto es espejo
   * para mostrar el desglose antes de pagar.
   */
  async getPlatformFees(): Promise<{ standardPct: number; homeCookPct: number }> {
    try {
      const r = await this.request<any>('/settings/platform-fees');
      const std = Number(r?.standardPct);
      const hc = Number(r?.homeCookPct);
      return {
        standardPct: Number.isFinite(std) ? Math.min(Math.max(std, 0), 100) : 15,
        homeCookPct: Number.isFinite(hc) ? Math.min(Math.max(hc, 0), 100) : 10,
      };
    } catch {
      return { standardPct: 15, homeCookPct: 10 };
    }
  }

  async getOrdersAdmin(params?: {
    take?: number;
    skip?: number;
    status?: string;
    search?: string;
  }) {
    const q = new URLSearchParams();
    if (params?.take != null) q.append('take', String(params.take));
    if (params?.skip != null) q.append('skip', String(params.skip));
    if (params?.status) q.append('status', params.status);
    if (params?.search) q.append('search', params.search);
    const s = q.toString();
    return this.request<any>(`/orders/admin/all${s ? `?${s}` : ''}`);
  }

  async getPaymentsAdmin(params?: {
    take?: number;
    skip?: number;
    status?: string;
    method?: string;
  }) {
    const q = new URLSearchParams();
    if (params?.take != null) q.append('take', String(params.take));
    if (params?.skip != null) q.append('skip', String(params.skip));
    if (params?.status) q.append('status', params.status);
    if (params?.method) q.append('method', params.method);
    const s = q.toString();
    return this.request<any>(`/payments/admin/all${s ? `?${s}` : ''}`);
  }

  /** Pagos crypto pendientes para reconciliación (admin). */
  async listPendingCryptoAdmin(params?: { take?: number; skip?: number }) {
    const q = new URLSearchParams();
    if (params?.take != null) q.append('take', String(params.take));
    if (params?.skip != null) q.append('skip', String(params.skip));
    const s = q.toString();
    return this.request<any>(`/payments/admin/crypto/pending${s ? `?${s}` : ''}`);
  }

  /** Fuerza re-verificación on-chain de un pago crypto (admin). */
  async reverifyCryptoPayment(orderId: string) {
    return this.request<any>('/payments/admin/crypto/reverify', {
      method: 'POST',
      body: { orderId },
    });
  } /** Tasa CRC/USD vigente del oracle del backend (público, sin auth). */
  async getCryptoRate() {
    return this.request<{ usdCrc: number; source: string; fetchedAt: string }>(
      '/payments/crypto/rate',
    );
  }

  /** Salud de las fuentes FX y última tasa cacheada (admin). */
  async getFxHealth() {
    return this.request<any>('/payments/admin/fx/health');
  }

  async getLivePulse() {
    return this.request<any>('/analytics/live');
  }

  async getRatingsAdmin(params?: {
    take?: number;
    skip?: number;
    minRating?: number;
    maxRating?: number;
    onlyWithComment?: boolean;
  }) {
    const q = new URLSearchParams();
    if (params?.take != null) q.append('take', String(params.take));
    if (params?.skip != null) q.append('skip', String(params.skip));
    if (params?.minRating != null) q.append('minRating', String(params.minRating));
    if (params?.maxRating != null) q.append('maxRating', String(params.maxRating));
    if (params?.onlyWithComment) q.append('onlyWithComment', 'true');
    const s = q.toString();
    return this.request<any>(`/ratings${s ? `?${s}` : ''}`);
  }

  // ============================================
  // 💰 WITHDRAWALS
  // ============================================

  async getBalance() {
    return this.request<any>('/withdrawals/balance');
  }

  async requestWithdrawal(data: {
    amount: number;
    paymentMethod: 'sinpe' | 'bank_transfer';
    sinpePhone?: string;
    sinpeName?: string;
    bankName?: string;
    accountNumber?: string;
    accountHolder?: string;
  }) {
    return this.request<any>('/withdrawals/request', {
      method: 'POST',
      body: data,
    });
  }

  async getMyWithdrawals(status?: string) {
    const params = status ? `?status=${status}` : '';
    return this.request<any>(`/withdrawals/my${params}`);
  }

  async getWithdrawalById(id: string) {
    return this.request<any>(`/withdrawals/my/${id}`);
  }
  async cancelWithdrawal(id: string) {
    return this.request<any>(`/withdrawals/my/${id}/cancel`, {
      method: 'PUT',
    });
  }

  // Admin withdrawal endpoints
  async getPendingWithdrawals() {
    return this.request<any>('/withdrawals/admin/pending');
  }

  async approveWithdrawal(id: string, transactionId?: string) {
    return this.request<any>(`/withdrawals/admin/${id}/approve`, {
      method: 'PUT',
      body: { transactionId },
    });
  }

  async completeWithdrawal(id: string, transactionId: string) {
    return this.request<any>(`/withdrawals/admin/${id}/complete`, {
      method: 'PUT',
      body: { transactionId },
    });
  }

  async rejectWithdrawal(id: string, reason: string) {
    return this.request<any>(`/withdrawals/admin/${id}/reject`, {
      method: 'PUT',
      body: { reason },
    });
  }

  // ============================================
  // 🗺️ GEOCODING
  // ============================================

  async searchAddresses(query: string, limit: number = 5, country?: string) {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    if (country) params.append('country', country);
    return this.request<any>(`/geocoding/search?${params.toString()}`);
  }

  async searchNicoyaAddresses(query: string, limit: number = 5) {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    return this.request<any>(`/geocoding/search/nicoya?${params.toString()}`);
  }

  async reverseGeocode(lat: number, lng: number) {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
    return this.request<any>(`/geocoding/reverse?${params.toString()}`);
  }

  /** Zona de referencia más cercana (el servidor marca confident/referenceOnly). */
  async nearestZone(lat: number, lng: number) {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
    return this.request<any>(`/geocoding/nearest-zone?${params.toString()}`);
  }

  async resolveMapLink(url: string) {
    const params = new URLSearchParams({ url });
    return this.request<any>(`/geocoding/resolve-link?${params.toString()}`);
  }

  async calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
    const params = new URLSearchParams({
      lat1: String(lat1),
      lng1: String(lng1),
      lat2: String(lat2),
      lng2: String(lng2),
    });
    return this.request<any>(`/geocoding/distance?${params.toString()}`);
  }

  // ============================================
  // 🗺️ ROUTING
  // ============================================

  async optimizeRoute(data: {
    startLocation: { lat: number; lng: number };
    orders: Array<{
      orderId: string;
      pickup: { lat: number; lng: number };
      delivery: { lat: number; lng: number };
      pickupAddress: string;
      deliveryAddress: string;
      merchantName: string;
    }>;
  }) {
    return this.request<any>('/routing/optimize', {
      method: 'POST',
      body: data,
    });
  }

  async calculateRoute(originLat: number, originLng: number, destLat: number, destLng: number) {
    const params = new URLSearchParams({
      originLat: String(originLat),
      originLng: String(originLng),
      destLat: String(destLat),
      destLng: String(destLng),
    });
    return this.request<any>(`/routing/route?${params.toString()}`);
  }

  // ============================================
  // 🚦 TRAFFIC
  // ============================================

  async getTrafficConditions(lat?: number, lng?: number) {
    const params = new URLSearchParams();
    if (lat != null) params.append('lat', String(lat));
    if (lng != null) params.append('lng', String(lng));
    return this.request<any>(`/routing/traffic?${params.toString()}`);
  }

  async getTrafficAdjustedETA(duration: number, lat?: number, lng?: number) {
    const params = new URLSearchParams({ duration: String(duration) });
    if (lat != null) params.append('lat', String(lat));
    if (lng != null) params.append('lng', String(lng));
    return this.request<any>(`/routing/traffic/eta?${params.toString()}`);
  }

  async getDeliveryEstimate(
    pickupLat: number,
    pickupLng: number,
    deliveryLat: number,
    deliveryLng: number,
    distance: number,
  ) {
    const params = new URLSearchParams({
      pickupLat: String(pickupLat),
      pickupLng: String(pickupLng),
      deliveryLat: String(deliveryLat),
      deliveryLng: String(deliveryLng),
      distance: String(distance),
    });
    return this.request<any>(`/routing/traffic/delivery-estimate?${params.toString()}`);
  }

  async compareRouteTraffic(
    routes: Array<{
      distance: number;
      duration: number;
      startLat: number;
      startLng: number;
      endLat: number;
      endLng: number;
    }>,
  ) {
    return this.request<any>('/routing/traffic/compare-routes', {
      method: 'POST',
      body: { routes },
    });
  }

  async getTrafficUpdates(points: Array<{ lat: number; lng: number }>) {
    return this.request<any>('/routing/traffic/updates', {
      method: 'POST',
      body: { points },
    });
  }

  // ============================================
  // 🚨 TRAFFIC ALERTS
  // ============================================

  async getTrafficAlerts(driverId: string, lat?: number, lng?: number) {
    const params = new URLSearchParams({ driverId });
    if (lat != null) params.append('lat', String(lat));
    if (lng != null) params.append('lng', String(lng));
    return this.request<any>(`/routing/alerts?${params.toString()}`);
  }

  async getSystemAlerts() {
    return this.request<any>('/routing/alerts/system');
  }

  async createTrafficAlert(data: {
    type: 'congestion' | 'accident' | 'road_closed' | 'weather' | 'event' | 'alternative_route';
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    message: string;
    location: { lat: number; lng: number; address: string };
    radius: number;
    durationMinutes: number;
    alternativeRoute?: { description: string; estimatedTimeSaved: number };
  }) {
    return this.request<any>('/routing/alerts', {
      method: 'POST',
      body: data,
    });
  }

  async dismissTrafficAlert(alertId: string, driverId: string) {
    return this.request<any>(`/routing/alerts/${alertId}/dismiss`, {
      method: 'PUT',
      body: { driverId },
    });
  }

  async markTrafficAlertAsRead(alertId: string, driverId: string) {
    return this.request<any>(`/routing/alerts/${alertId}/read`, {
      method: 'PUT',
      body: { driverId },
    });
  }

  async getAlertStats() {
    return this.request<any>('/routing/alerts/stats');
  }

  async getAlternativeRoute(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
  ) {
    return this.request<any>('/routing/alerts/alternative-route', {
      method: 'POST',
      body: { originLat, originLng, destLat, destLng },
    });
  }

  // ============================================
  // 📊 TRAFFIC HISTORY
  // ============================================

  async getTrafficHistory(zone?: string, startDate?: string, endDate?: string, limit?: number) {
    const params = new URLSearchParams();
    if (zone) params.append('zone', zone);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (limit) params.append('limit', String(limit));
    return this.request<any>(`/routing/history?${params.toString()}`);
  }

  async getTrafficPatterns(zone?: string, daysBack?: number) {
    const params = new URLSearchParams();
    if (zone) params.append('zone', zone);
    if (daysBack) params.append('daysBack', String(daysBack));
    return this.request<any>(`/routing/history/patterns?${params.toString()}`);
  }

  async getTrafficTrends(zone?: string, period?: string) {
    const params = new URLSearchParams();
    if (zone) params.append('zone', zone);
    if (period) params.append('period', period);
    return this.request<any>(`/routing/history/trends?${params.toString()}`);
  }

  async getTrafficHeatmap(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.request<any>(`/routing/history/heatmap?${params.toString()}`);
  }

  async getMerchantTrafficReport(merchantId: string, period?: string) {
    const params = new URLSearchParams();
    if (period) params.append('period', period);
    return this.request<any>(`/routing/history/merchant/${merchantId}?${params.toString()}`);
  }

  async getBestDeliveryTimes(lat: number, lng: number, daysBack?: number) {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
    if (daysBack) params.append('daysBack', String(daysBack));
    return this.request<any>(`/routing/history/best-times?${params.toString()}`);
  }

  async getWorstDeliveryTimes(lat: number, lng: number, daysBack?: number) {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
    if (daysBack) params.append('daysBack', String(daysBack));
    return this.request<any>(`/routing/history/worst-times?${params.toString()}`);
  }

  // ============================================
  // 🗺️ ROUTE SUGGESTIONS
  // ============================================

  async getRouteSuggestions(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
    options?: {
      prioritizeSpeed?: boolean;
      vehicleType?: string;
    },
  ) {
    const params = new URLSearchParams({
      originLat: String(originLat),
      originLng: String(originLng),
      destLat: String(destLat),
      destLng: String(destLng),
    });
    if (options?.prioritizeSpeed) params.append('prioritizeSpeed', 'true');
    if (options?.vehicleType) params.append('vehicleType', options.vehicleType);
    return this.request<any>(`/routing/suggestions?${params.toString()}`);
  }

  async getQuickSuggestion(originLat: number, originLng: number, destLat: number, destLng: number) {
    const params = new URLSearchParams({
      originLat: String(originLat),
      originLng: String(originLng),
      destLat: String(destLat),
      destLng: String(destLng),
    });
    return this.request<any>(`/routing/suggestions/quick?${params.toString()}`);
  }

  async getTrafficAwareETAs(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
  ) {
    const params = new URLSearchParams({
      originLat: String(originLat),
      originLng: String(originLng),
      destLat: String(destLat),
      destLng: String(destLng),
    });
    return this.request<any>(`/routing/suggestions/etas?${params.toString()}`);
  }

  async getRouteWithWarnings(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
  ) {
    const params = new URLSearchParams({
      originLat: String(originLat),
      originLng: String(originLng),
      destLat: String(destLat),
      destLng: String(destLng),
    });
    return this.request<any>(`/routing/suggestions/with-warnings?${params.toString()}`);
  }

  async getAlternativeForBlockedRoute(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
    blockedRouteId: string,
  ) {
    return this.request<any>('/routing/suggestions/blocked', {
      method: 'POST',
      body: { originLat, originLng, destLat, destLng, blockedRouteId },
    });
  }

  // ============================================
  // 🔮 TRAFFIC PREDICTIONS
  // ============================================

  async getTrafficPrediction(lat: number, lng: number, time: string) {
    const params = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
      time,
    });
    return this.request<any>(`/routing/predictions?${params.toString()}`);
  }

  async getHourlyForecast(lat: number, lng: number) {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
    return this.request<any>(`/routing/predictions/hourly?${params.toString()}`);
  }

  async getDailyForecast(lat: number, lng: number, days?: number) {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
    if (days) params.append('days', String(days));
    return this.request<any>(`/routing/predictions/daily?${params.toString()}`);
  }

  async getBestDeliveryTimesPredictions(lat: number, lng: number, days?: number) {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
    if (days) params.append('days', String(days));
    return this.request<any>(`/routing/predictions/best-times?${params.toString()}`);
  }

  async getTrafficTrendPredictions(lat: number, lng: number, timeframe?: string) {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
    if (timeframe) params.append('timeframe', timeframe);
    return this.request<any>(`/routing/predictions/trend?${params.toString()}`);
  }

  async getPredictionAccuracy() {
    return this.request<any>('/routing/predictions/accuracy');
  }

  async getPatternInsights(lat: number, lng: number) {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
    return this.request<any>(`/routing/predictions/insights?${params.toString()}`);
  }
}

// Export singleton instance
export const api = new ApiClient(API_BASE_URL);

/**
 * Authenticated fetch against the API (base URL + JWT).
 *
 * Drop-in replacement for raw `fetch('/api/...')`, which 404s in prod
 * (no Next rewrite proxies it) and goes out without Authorization.
 */
export function resolveApiUrl(path: string): string {
  if (path.startsWith('http')) return path;
  const base = API_BASE_URL.replace(/\/$/, '');
  // API_BASE_URL already ends with /api: strip the Next-style prefix
  // so '/api/orders' → '<base>/orders', not '<base>/api/orders'.
  const normalized = path.replace(/^\/api(?=\/|$)/, '') || '/';
  return `${base}${normalized.startsWith('/') ? '' : '/'}${normalized}`;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || undefined);
  // Default JSON content-type only for string bodies: setting it on
  // FormData/Blob would break the browser's multipart boundary.
  if (typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const token = api.getToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(resolveApiUrl(path), { ...init, headers });
}

// Export types
export interface User {
  id: string;
  email?: string;
  phone?: string;
  role: 'merchant' | 'driver' | 'admin';
  status: string;
  merchantProfile?: MerchantProfile;
  driverProfile?: DriverProfile;
}

export interface MerchantProfile {
  id: string;
  userId: string;
  businessName: string;
  address: string;
  kycStatus: string;
}

export interface DriverProfile {
  id: string;
  userId: string;
  fullName: string;
  vehicleType: string;
  level: string;
  rating: number;
  totalTrips: number;
  status: string;
  kycStatus: string;
}

export interface Order {
  id: string;
  merchantId: string;
  driverId?: string;
  status: string;
  orderType: string;
  scheduledDate?: string;
  scheduledTime?: string;
  pickupAddress: string;
  pickupLat?: number | string | null;
  pickupLng?: number | string | null;
  deliveryAddress: string;
  deliveryLat?: number | string | null;
  deliveryLng?: number | string | null;
  distanceKm?: number | string | null;
  basePrice: number;
  commission: number;
  driverPayout: number;
  totalAmount: number;
  // Flete / encomiendas
  kind?: 'food' | 'freight';
  productsTotal?: number;
  packageDescription?: string | null;
  packageSize?: string | null;
  declaredValue?: number | string | null;
  weightKg?: number | string | null;
  specialInstructions?: string;
  customerName?: string | null;
  customerPhone?: string | null;
  /** Efectivo: con cuánto paga el cliente (null = no indicó). */
  cashTendered?: number | string | null;
  /** Pago registrado (método/estado), cuando existe fila Payment. */
  payment?: { status: string; method: string } | null;
  // Evidencia fotográfica 1+1 (el backend las exige para avanzar).
  pickupProofPhotoUrl?: string | null;
  pickupProofAt?: string | null;
  deliveryProofPhotoUrl?: string | null;
  deliveryProofAt?: string | null;
  createdAt: string;
  merchant?: { businessName?: string | null; user?: { phone?: string | null } | null } | null;
  items?: Array<{
    id: string;
    name: string;
    price: number | string;
    quantity: number;
    notes?: string | null;
  }>;
}

export interface VariantOption {
  id: string;
  name: string;
  priceDelta: number;
  isAvailable?: boolean;
}

export interface VariantGroup {
  id: string;
  name: string;
  required: boolean;
  multiple: boolean;
  /** Tope de opciones elegibles (ej. 3 frutas). Ausente = sin tope. */
  maxSelections?: number | null;
  options: VariantOption[];
}

export interface MenuItem {
  id: string;
  merchantId: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  isPopular: boolean;
  isAvailable: boolean;
  sortOrder: number;
  variantGroups?: VariantGroup[];
  /** Días 0=dom…6=sáb en que se ofrece. Vacío/ausente = todos los días. */
  availableDays?: number[];
  /** Stock del día de venta. Null/ausente = sin límite. */
  stockQty?: number | null;
  /** Tamaño del lote diario (cada día el stock vuelve a este valor). */
  dailyQty?: number | null;
  /** Solo-mañana (no hoy): se muestra en preventa. */
  offeredTomorrow?: boolean;
  /** Nota de entrega programada ("Se entrega el jueves a las 2:00 p. m."). */
  fulfillNote?: string | null;
}

export interface MerchantPublicProfile {
  id: string;
  businessName: string;
  address: string;
  description: string;
  logoUrl: string;
  latitude: number;
  longitude: number;
  rating: number;
  totalRatings: number;
  activeOrders: number;
  isOpen: boolean;
  openingHours: any;
  category?: string;
  /** Cocina casera (emprendedores): sección propia + preventa. */
  isHomeCook?: boolean;
  /** Redes normalizadas { instagram, facebook, tiktok, whatsapp, website }. */
  socials?: Record<string, string> | null;
}

export interface DriverProposal {
  id: string;
  orderId: string;
  driverId: string;
  status: 'pending' | 'accepted' | 'rejected';
  estimatedArrival: string;
  message: string;
  createdAt: string;
  driver?: {
    id: string;
    fullName: string;
    vehicleType: 'motorcycle' | 'motorized_bike' | 'bicycle' | 'car' | 'truck';
    rating: number;
    totalTrips: number;
  };
}
