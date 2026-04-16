import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  catchError,
  finalize,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
  tap,
} from 'rxjs';

import { AuthResponse, CurrentUser, LoginPayload, RegisterPayload } from './models';

const LEGACY_ACCESS_TOKEN_KEY = 'skillswap_access_token';
const LEGACY_REFRESH_TOKEN_KEY = 'skillswap_refresh_token';
const SESSION_COOKIE_KEY = 'skillswap_session';
const SESSION_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly currentUser = signal<CurrentUser | null>(null);
  readonly isRestoring = signal(false);
  readonly isLoggingOut = signal(false);
  readonly isAuthenticated = computed(() => Boolean(this.currentUser()) || this.sessionHint());

  private readonly sessionHint = signal(this.readSessionHint());
  private restoreRequest: Observable<boolean> | null = null;
  private hasAttemptedRestore = false;

  constructor() {
    this.restoreSession();
  }

  login(payload: LoginPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/login/', payload).pipe(
      tap((response) => this.applyAuthenticatedUser(response.user)),
    );
  }

  register(payload: RegisterPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/register/', payload).pipe(
      tap((response) => this.applyAuthenticatedUser(response.user)),
    );
  }

  restoreSession(): void {
    if (this.hasAttemptedRestore || !this.hasSessionCandidate()) {
      return;
    }

    this.ensureSession().subscribe();
  }

  logout(): void {
    if (this.isLoggingOut()) {
      return;
    }

    this.isLoggingOut.set(true);
    this.http
      .post<void>('/api/auth/logout/', {})
      .pipe(catchError(() => of(void 0)))
      .subscribe(() => this.finishLogout());
  }

  ensureSession(): Observable<boolean> {
    if (this.currentUser()) {
      return of(true);
    }

    if (!this.hasSessionCandidate()) {
      this.hasAttemptedRestore = true;
      return of(false);
    }

    if (this.restoreRequest) {
      return this.restoreRequest;
    }

    this.hasAttemptedRestore = true;
    this.isRestoring.set(true);
    this.restoreRequest = this.fetchCurrentUser().pipe(
      tap((user) => this.applyAuthenticatedUser(user)),
      map(() => true),
      catchError((error) => this.recoverFromRestoreFailure(error)),
      finalize(() => {
        this.isRestoring.set(false);
        this.restoreRequest = null;
      }),
      shareReplay(1),
    );
    return this.restoreRequest;
  }

  private applyAuthenticatedUser(user: CurrentUser): void {
    this.currentUser.set(user);
    this.sessionHint.set(true);
    this.writeCookie(SESSION_COOKIE_KEY, '1', SESSION_COOKIE_MAX_AGE_SECONDS);
    this.clearLegacyLocalStorage();
  }

  private clearSession(): void {
    this.currentUser.set(null);
    this.sessionHint.set(false);
    this.removeCookie(SESSION_COOKIE_KEY);
    this.clearLegacyLocalStorage();
  }

  private fetchCurrentUser(): Observable<CurrentUser> {
    return this.http.get<CurrentUser>('/api/auth/me/');
  }

  private recoverFromRestoreFailure(error: unknown): Observable<boolean> {
    if (!this.isAuthError(error)) {
      return of(this.hasSessionCandidate());
    }

    const legacyRefreshToken = this.readLegacyRefreshToken();
    const payload = legacyRefreshToken ? { refresh: legacyRefreshToken } : {};

    return this.http.post('/api/auth/refresh/', payload).pipe(
      tap(() => {
        this.sessionHint.set(true);
        this.writeCookie(SESSION_COOKIE_KEY, '1', SESSION_COOKIE_MAX_AGE_SECONDS);
      }),
      switchMap(() => this.fetchCurrentUser()),
      tap((user) => this.applyAuthenticatedUser(user)),
      map(() => true),
      catchError((refreshError) => {
        if (
          refreshError instanceof HttpErrorResponse &&
          [400, 401, 403].includes(refreshError.status)
        ) {
          this.clearSession();
          return of(false);
        }

        return of(this.hasSessionCandidate());
      }),
    );
  }

  private isAuthError(error: unknown): boolean {
    return error instanceof HttpErrorResponse && [401, 403].includes(error.status);
  }

  private hasSessionCandidate(): boolean {
    return Boolean(
      this.sessionHint() || this.readLegacyAccessToken() || this.readLegacyRefreshToken(),
    );
  }

  private readLegacyAccessToken(): string | null {
    return this.readCookie(LEGACY_ACCESS_TOKEN_KEY) || this.readStorage(LEGACY_ACCESS_TOKEN_KEY);
  }

  private readLegacyRefreshToken(): string | null {
    return this.readCookie(LEGACY_REFRESH_TOKEN_KEY) || this.readStorage(LEGACY_REFRESH_TOKEN_KEY);
  }

  private clearLegacyLocalStorage(): void {
    this.removeStorage(LEGACY_ACCESS_TOKEN_KEY);
    this.removeStorage(LEGACY_REFRESH_TOKEN_KEY);
  }

  private readSessionHint(): boolean {
    return Boolean(this.readCookie(SESSION_COOKIE_KEY));
  }

  private readCookie(key: string): string | null {
    if (typeof document === 'undefined') {
      return null;
    }

    const prefix = `${key}=`;
    const cookie = document.cookie.split('; ').find((entry) => entry.startsWith(prefix));
    return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
  }

  private writeCookie(key: string, value: string, maxAgeSeconds: number): void {
    if (typeof document === 'undefined') {
      return;
    }

    document.cookie =
      `${key}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax` +
      this.cookieSecuritySuffix();
  }

  private removeCookie(key: string): void {
    if (typeof document === 'undefined') {
      return;
    }

    document.cookie = `${key}=; Path=/; Max-Age=0; SameSite=Lax${this.cookieSecuritySuffix()}`;
  }

  private cookieSecuritySuffix(): string {
    return typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  }

  private readStorage(key: string): string | null {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(key);
  }

  private removeStorage(key: string): void {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(key);
    }
  }

  private finishLogout(): void {
    this.clearSession();
    this.isLoggingOut.set(false);
    this.router.navigateByUrl('/login');
  }
}
