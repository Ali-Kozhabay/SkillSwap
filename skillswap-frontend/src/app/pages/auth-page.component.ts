import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { formatApiError } from '../core/api-error';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-auth-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="auth-stage">
      <div class="auth-stack">
        <div class="auth-intro stack-lg">
          <div class="auth-logo-row">
            <span class="auth-logo-mark">S</span>
            <div>
              <p class="eyebrow">SkillSwap</p>
              <h1>{{ mode() === 'login' ? 'Sign in' : 'Create account' }}</h1>
            </div>
          </div>

          <p class="lede">
            {{ mode() === 'login'
              ? 'Access your bookings, messages, and services from one clean dashboard.'
              : 'Join SkillSwap to offer services, handle client or executive requests, and manage work in one place.' }}
          </p>

          <div class="auth-pill-row">
            <span class="auth-mini-pill">Secure login</span>
            <span class="auth-mini-pill">Client and executive ready</span>
            <span class="auth-mini-pill">Reviews after completion</span>
          </div>

          <a class="ghost-button auth-browse-link" routerLink="/services">Browse marketplace first</a>
        </div>

        <div class="panel auth-card auth-card-centered stack-lg">
          <div class="stack-md">
            <p class="eyebrow">{{ mode() === 'login' ? 'Sign in' : 'Sign up' }}</p>
            <h2>{{ mode() === 'login' ? 'Log in to your account' : 'Start your SkillSwap account' }}</h2>
            <p class="muted">
              {{ mode() === 'login'
                ? 'Use your username and password to continue.'
                : registerStep() === 1
                  ? 'Step 1 of 2: enter your account details first.'
                  : 'Step 2 of 2: finish your public profile details.' }}
            </p>
          </div>

          <div class="tab-row">
            <button
              type="button"
              class="tab-button"
              [class.is-active]="mode() === 'login'"
              (click)="switchMode('login')"
            >
              Log in
            </button>
            <button
              type="button"
              class="tab-button"
              [class.is-active]="mode() === 'register'"
              (click)="switchMode('register')"
            >
              Sign up
            </button>
          </div>

          @if (error()) {
            <p class="error-banner">{{ error() }}</p>
          }

          @if (mode() === 'login') {
            <form class="stack-lg" (ngSubmit)="submitLogin()">
              <div class="field">
                <label for="login-username">Username</label>
                <input
                  id="login-username"
                  name="loginUsername"
                  [(ngModel)]="loginForm.username"
                  autocomplete="username"
                  placeholder="Enter your username"
                  required
                />
              </div>

              <div class="field">
                <label for="login-password">Password</label>
                <div class="input-shell">
                  <input
                    id="login-password"
                    [type]="showLoginPassword() ? 'text' : 'password'"
                    name="loginPassword"
                    [(ngModel)]="loginForm.password"
                    autocomplete="current-password"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    class="text-link-button"
                    type="button"
                    (click)="showLoginPassword.set(!showLoginPassword())"
                  >
                    {{ showLoginPassword() ? 'Hide' : 'Show' }}
                  </button>
                </div>
              </div>

              <button class="primary-button auth-submit" type="submit" [disabled]="submitting()">
                {{ submitting() ? 'Signing in...' : 'Log in' }}
              </button>

              <p class="auth-alt">
                New to SkillSwap?
                <button class="text-link-button" type="button" (click)="switchMode('register')">
                  Create an account
                </button>
              </p>
            </form>
          } @else {
            <div class="auth-step-row">
              <div class="auth-step" [class.is-active]="registerStep() === 1">
                <span>1</span>
                <strong>Account</strong>
              </div>
              <div class="auth-step" [class.is-active]="registerStep() === 2">
                <span>2</span>
                <strong>Profile</strong>
              </div>
            </div>

            <form class="stack-lg" (ngSubmit)="submitRegister()">
              @if (registerStep() === 1) {
                <div class="field">
                  <label for="register-email">Email</label>
                  <input
                    id="register-email"
                    type="email"
                    name="registerEmail"
                    [(ngModel)]="registerForm.email"
                    autocomplete="email"
                    placeholder="you@example.com"
                    required
                  />
                </div>

                <div class="field">
                  <label for="register-password">Password</label>
                  <div class="input-shell">
                    <input
                      id="register-password"
                      [type]="showRegisterPassword() ? 'text' : 'password'"
                      name="registerPassword"
                      [(ngModel)]="registerForm.password"
                      autocomplete="new-password"
                      placeholder="Create a password"
                      required
                    />
                    <button
                      class="text-link-button"
                      type="button"
                      (click)="showRegisterPassword.set(!showRegisterPassword())"
                    >
                      {{ showRegisterPassword() ? 'Hide' : 'Show' }}
                    </button>
                  </div>
                  <span class="field-note">Use at least 8 characters.</span>
                </div>

                <div class="field">
                  <label for="register-confirm-password">Confirm password</label>
                  <div class="input-shell">
                    <input
                      id="register-confirm-password"
                      [type]="showRegisterConfirmPassword() ? 'text' : 'password'"
                      name="registerConfirmPassword"
                      [(ngModel)]="registerForm.confirm_password"
                      autocomplete="new-password"
                      placeholder="Repeat your password"
                      required
                    />
                    <button
                      class="text-link-button"
                      type="button"
                      (click)="showRegisterConfirmPassword.set(!showRegisterConfirmPassword())"
                    >
                      {{ showRegisterConfirmPassword() ? 'Hide' : 'Show' }}
                    </button>
                  </div>
                </div>

                <button class="primary-button auth-submit" type="button" (click)="goToRegisterStepTwo()">
                  Next
                </button>
              } @else {
                <div class="field">
                  <label for="register-username">Username</label>
                  <input
                    id="register-username"
                    name="registerUsername"
                    [(ngModel)]="registerForm.username"
                    autocomplete="username"
                    placeholder="Choose a username"
                    required
                  />
                  <span class="field-note">This is how other users will recognize you.</span>
                </div>

                <div class="grid-2">
                  <div class="field">
                    <label for="register-first-name">First name</label>
                    <input
                      id="register-first-name"
                      name="registerFirstName"
                      [(ngModel)]="registerForm.first_name"
                      autocomplete="given-name"
                      placeholder="First name"
                    />
                  </div>
                  <div class="field">
                    <label for="register-last-name">Last name</label>
                    <input
                      id="register-last-name"
                      name="registerLastName"
                      [(ngModel)]="registerForm.last_name"
                      autocomplete="family-name"
                      placeholder="Last name"
                    />
                  </div>
                </div>

                <div class="field">
                  <label for="register-location">Location</label>
                  <input
                    id="register-location"
                    name="registerLocation"
                    [(ngModel)]="registerForm.location"
                    autocomplete="address-level2"
                    placeholder="City or remote"
                  />
                </div>

                <div class="field">
                  <label for="register-bio">Bio</label>
                  <textarea
                    id="register-bio"
                    name="registerBio"
                    [(ngModel)]="registerForm.bio"
                    placeholder="A short intro that helps clients trust your profile"
                  ></textarea>
                  <span class="field-note">Optional, but useful if you want to sell services.</span>
                </div>

                <div class="auth-actions-split">
                  <button class="ghost-button" type="button" (click)="registerStep.set(1)">
                    Back
                  </button>
                  <button class="primary-button" type="submit" [disabled]="submitting()">
                    {{ submitting() ? 'Creating account...' : 'Create account' }}
                  </button>
                </div>
              }

              <p class="auth-alt">
                Already have an account?
                <button class="text-link-button" type="button" (click)="switchMode('login')">
                  Log in instead
                </button>
              </p>
            </form>
          }

          <p class="muted auth-footer-note">
            Prefer to browse first? <a routerLink="/services"><strong>Open the marketplace</strong></a>
          </p>
        </div>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly mode = signal<'login' | 'register'>('login');
  readonly registerStep = signal<1 | 2>(1);
  readonly error = signal('');
  readonly submitting = signal(false);
  readonly showLoginPassword = signal(false);
  readonly showRegisterPassword = signal(false);
  readonly showRegisterConfirmPassword = signal(false);

  readonly loginForm = {
    username: '',
    password: '',
  };

  readonly registerForm = {
    username: '',
    email: '',
    password: '',
    confirm_password: '',
    first_name: '',
    last_name: '',
    location: '',
    bio: '',
  };

  switchMode(mode: 'login' | 'register'): void {
    this.mode.set(mode);
    this.error.set('');
    if (mode === 'register') {
      this.registerStep.set(1);
    }
  }

  goToRegisterStepTwo(): void {
    this.error.set('');

    if (!this.registerForm.email.trim()) {
      this.error.set('Enter your email first.');
      return;
    }

    if (!this.registerForm.password) {
      this.error.set('Create a password first.');
      return;
    }

    if (this.registerForm.password.length < 8) {
      this.error.set('Password must be at least 8 characters.');
      return;
    }

    if (this.registerForm.password !== this.registerForm.confirm_password) {
      this.error.set('Passwords do not match.');
      return;
    }

    this.registerStep.set(2);
  }

  submitLogin(): void {
    this.error.set('');
    this.submitting.set(true);

    this.auth.login(this.loginForm).subscribe({
      next: () => {
        this.submitting.set(false);
        this.router.navigateByUrl('/dashboard');
      },
      error: (error) => {
        this.submitting.set(false);
        this.error.set(formatApiError(error));
      },
    });
  }

  submitRegister(): void {
    this.error.set('');

    if (this.registerStep() !== 2) {
      this.goToRegisterStepTwo();
      return;
    }

    if (!this.registerForm.username.trim()) {
      this.error.set('Choose a username to finish registration.');
      return;
    }

    this.submitting.set(true);

    this.auth.register(this.registerForm).subscribe({
      next: () => {
        this.submitting.set(false);
        this.router.navigateByUrl('/dashboard');
      },
      error: (error) => {
        this.submitting.set(false);
        this.error.set(formatApiError(error));
      },
    });
  }
}
