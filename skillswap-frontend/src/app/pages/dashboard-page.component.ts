import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { formatApiError } from '../core/api-error';
import { AuthService } from '../core/auth.service';
import { Booking, Category, MyBookingsResponse, Service } from '../core/models';
import { MarketplaceService } from '../core/marketplace.service';

type ReviewDraft = {
  rating: number;
  comment: string;
};

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="stack-2xl dashboard-page">
      <section class="panel hero-panel dashboard-hero-shell">
        <div class="dashboard-hero-main stack-lg">
          <div class="stack-lg">
            <p class="eyebrow">Dashboard overview</p>
            <h1 class="dashboard-hero-title">Keep listings, requests, and bookings organized.</h1>
            <p class="lede">
              Publish services, respond to incoming requests, track your own bookings, and leave
              reviews after work is completed.
            </p>
          </div>

          <div class="chip-row">
            <span class="metric-pill">
              {{ activeListingCount() }} active listing{{ activeListingCount() === 1 ? '' : 's' }}
            </span>
            <span class="metric-pill">
              {{ pendingProviderCount() }} pending request{{ pendingProviderCount() === 1 ? '' : 's' }}
            </span>
            <span class="metric-pill">
              {{ waitingReviewCount() }} review{{ waitingReviewCount() === 1 ? '' : 's' }} waiting
            </span>
          </div>

          <div class="actions-row">
            <a class="primary-button" routerLink="/services">Browse marketplace</a>
            <a class="secondary-button" routerLink="/services">Find more services</a>
          </div>
        </div>

        <div class="dashboard-overview">
          <article class="dashboard-account-card stack-md">
            <div class="dashboard-account-header">
              <div class="stack-md">
                <p class="eyebrow">Account summary</p>
                <h2>{{ auth.currentUser()?.display_name || 'Your account' }}</h2>
              </div>
              <span class="status-pill status-muted">Live dashboard</span>
            </div>
            <p class="muted">
              This is the operations layer of the marketplace: service creation, booking
              management, completion tracking, and post-project reviews.
            </p>
          </article>

          <div class="dashboard-stat-grid">
            <article class="dashboard-stat-card">
              <strong>{{ myServices().length }}</strong>
              <span>Your listings</span>
            </article>
            <article class="dashboard-stat-card">
              <strong>{{ bookings().as_provider.length }}</strong>
              <span>Incoming requests</span>
            </article>
            <article class="dashboard-stat-card">
              <strong>{{ bookings().as_client.length }}</strong>
              <span>Your bookings</span>
            </article>
            <article class="dashboard-stat-card">
              <strong>{{ categories().length }}</strong>
              <span>Marketplace categories</span>
            </article>
            <article class="dashboard-stat-card">
              <strong>{{ pendingProviderCount() }}</strong>
              <span>Pending requests</span>
            </article>
            <article class="dashboard-stat-card">
              <strong>{{ waitingReviewCount() }}</strong>
              <span>Reviews waiting</span>
            </article>
          </div>
        </div>
      </section>

      @if (error()) {
        <p class="error-banner">{{ error() }}</p>
      }

      @if (success()) {
        <p class="success-banner">{{ success() }}</p>
      }

      <section class="panel stack-lg dashboard-compose-panel">
        <div class="stack-md">
          <p class="eyebrow">Create a service</p>
          <h2>Start a new listing on its own page</h2>
          <p class="muted">
            Open the dedicated service builder, write the offer there, and save it back into the
            marketplace.
          </p>
        </div>

        <div class="dashboard-create-cta stack-md">
          <div class="helper-list">
            <p><strong>Dedicated form:</strong> Focus only on the service details.</p>
            <p><strong>Cleaner dashboard:</strong> Keep operations and creation separate.</p>
            <p><strong>Save once:</strong> Publish and return here after the listing is ready.</p>
          </div>

          <div class="actions-row">
            <a class="primary-button" routerLink="/dashboard/services/new">Create service</a>
            <span class="metric-pill">Opens a full-page builder</span>
          </div>
        </div>
      </section>

      <section class="section-shell">
        <div class="section-header">
          <div class="stack-md">
            <p class="eyebrow">Your services</p>
            <h2>Current listings</h2>
          </div>
          <span class="metric-pill">{{ myServices().length }} total</span>
        </div>

        @if (myServices().length === 0) {
          <div class="empty-state">
            <p>You have not created a service yet.</p>
          </div>
        }

        <div class="dashboard-card-grid">
          @for (service of myServices(); track service.id) {
            <article class="service-mini-card">
              <div class="listing-head">
                <div>
                  <h3>{{ service.title }}</h3>
                  <p class="muted">{{ service.summary }}</p>
                </div>
                <div class="price-block">
                  <span class="price-label">Price</span>
                  <div class="price-value">{{ service.price | currency:'KZT ':'symbol':'1.0-0' }}</div>
                </div>
              </div>

              <div class="chip-row">
                <span class="badge">{{ service.category.name }}</span>
                <span class="status-pill" [class.status-muted]="!service.is_active">
                  {{ service.is_active ? 'Active' : 'Paused' }}
                </span>
              </div>

              <div class="actions-row">
                <span class="muted">{{ service.location }}</span>
                <a class="ghost-button" [routerLink]="['/service', service.id]">Manage listing</a>
              </div>
            </article>
          }
        </div>
      </section>

      <section class="section-shell">
        <div class="section-header">
          <div class="stack-md">
            <p class="eyebrow">Incoming requests</p>
            <h2>Bookings on your services</h2>
          </div>
          <span class="metric-pill">{{ bookings().as_provider.length }} total</span>
        </div>

        @if (bookings().as_provider.length === 0) {
          <div class="empty-state">
            <p>No one has booked your services yet.</p>
          </div>
        }

        <div class="dashboard-card-grid">
          @for (booking of providerBookingsPage(); track booking.id) {
            <article class="booking-card">
              <div class="card-topline">
                <div>
                  <h3>{{ booking.service.title }}</h3>
                  <p class="muted">Client: {{ booking.client.display_name }}</p>
                </div>
                <span class="status-pill" [class.status-complete]="booking.status === 'completed'">
                  {{ booking.status }}
                </span>
              </div>

              <div class="meta-grid">
                <div>
                  <span class="meta-label">Scheduled for</span>
                  <p>{{ booking.scheduled_for ? (booking.scheduled_for | date:'medium') : 'Flexible schedule' }}</p>
                </div>
                <div>
                  <span class="meta-label">Created</span>
                  <p>{{ booking.created_at | date:'mediumDate' }}</p>
                </div>
                <div>
                  <span class="meta-label">Note</span>
                  <p>{{ booking.note || 'No booking note provided.' }}</p>
                </div>
                <div>
                  <span class="meta-label">Completion</span>
                  <p>{{ providerCompletionSummary(booking) }}</p>
                </div>
              </div>

              <div class="actions-row">
                <a class="ghost-button" [routerLink]="['/chat', booking.id]">Open chat</a>
                @if (booking.status === 'pending') {
                  <button class="primary-button" type="button" (click)="changeBookingStatus(booking, 'accepted')">
                    Accept booking
                  </button>
                } @else if (booking.status === 'accepted' && !booking.provider_completion_confirmed) {
                  <button class="secondary-button" type="button" (click)="changeBookingStatus(booking, 'completed')">
                    Confirm completion
                  </button>
                } @else if (booking.status === 'accepted' && booking.provider_completion_confirmed) {
                  <span class="metric-pill">Waiting for client confirmation</span>
                }
              </div>
            </article>
          }
        </div>

        @if (bookings().as_provider.length > pageSize) {
          <div class="dashboard-pagination">
            <span class="muted">
              Showing {{ pageStart(bookings().as_provider.length, providerPage()) }} to
              {{ pageEnd(bookings().as_provider.length, providerPage()) }} of
              {{ bookings().as_provider.length }}
            </span>
            <div class="actions-row">
              <button
                class="ghost-button"
                type="button"
                (click)="previousProviderPage()"
                [disabled]="providerPage() === 0"
              >
                Previous 10
              </button>
              <button
                class="ghost-button"
                type="button"
                (click)="nextProviderPage()"
                [disabled]="!hasNextPage(bookings().as_provider.length, providerPage())"
              >
                Next 10
              </button>
            </div>
          </div>
        }
      </section>

      <section class="section-shell">
        <div class="section-header">
          <div class="stack-md">
            <p class="eyebrow">Your bookings</p>
            <h2>Services you booked from others</h2>
          </div>
          <span class="metric-pill">{{ bookings().as_client.length }} total</span>
        </div>

        @if (bookings().as_client.length === 0) {
          <div class="empty-state">
            <p>You have not booked a service yet.</p>
          </div>
        }

        <div class="dashboard-card-grid">
          @for (booking of clientBookingsPage(); track booking.id) {
            <article class="booking-card">
              <div class="card-topline">
                <div>
                  <h3>{{ booking.service.title }}</h3>
                  <p class="muted">Executive: {{ booking.provider.display_name }}</p>
                </div>
                <span class="status-pill" [class.status-complete]="booking.status === 'completed'">
                  {{ booking.status }}
                </span>
              </div>

              <div class="meta-grid">
                <div>
                  <span class="meta-label">Scheduled for</span>
                  <p>{{ booking.scheduled_for ? (booking.scheduled_for | date:'medium') : 'Flexible schedule' }}</p>
                </div>
                <div>
                  <span class="meta-label">Price</span>
                  <p>{{ booking.service.price | currency:'KZT ':'symbol':'1.0-0' }}</p>
                </div>
                <div>
                  <span class="meta-label">Note</span>
                  <p>{{ booking.note || 'No booking note provided.' }}</p>
                </div>
                <div>
                  <span class="meta-label">Completion</span>
                  <p>{{ clientCompletionSummary(booking) }}</p>
                </div>
                <div>
                  <span class="meta-label">Reviews</span>
                  <p>{{ reviewAvailabilitySummary(booking) }}</p>
                </div>
              </div>

              <div class="actions-row">
                <a class="ghost-button" [routerLink]="['/chat', booking.id]">Open chat</a>
                @if (booking.status === 'accepted' && booking.provider_completion_confirmed) {
                  <button class="secondary-button" type="button" (click)="changeBookingStatus(booking, 'completed')">
                    Confirm completion
                  </button>
                } @else if (booking.status === 'accepted') {
                  <span class="metric-pill">Waiting for executive confirmation</span>
                }
              </div>

              @if (booking.review) {
                <div class="review-inline">
                  <strong>Your review: {{ booking.review.rating }}/5</strong>
                  <p>{{ booking.review.comment || 'No written comment provided.' }}</p>
                </div>
              } @else if (booking.can_review) {
                <form class="review-form" (ngSubmit)="submitReview(booking.id)">
                  <div class="grid-2">
                    <div class="field">
                      <label [for]="'rating-' + booking.id">Rating</label>
                      <select
                        [id]="'rating-' + booking.id"
                        [name]="'rating-' + booking.id"
                        [(ngModel)]="reviewDraft(booking.id).rating"
                      >
                        <option [ngValue]="5">5</option>
                        <option [ngValue]="4">4</option>
                        <option [ngValue]="3">3</option>
                        <option [ngValue]="2">2</option>
                        <option [ngValue]="1">1</option>
                      </select>
                    </div>
                  </div>

                  <div class="field">
                    <label [for]="'comment-' + booking.id">Comment</label>
                    <textarea
                      [id]="'comment-' + booking.id"
                      [name]="'comment-' + booking.id"
                      [(ngModel)]="reviewDraft(booking.id).comment"
                      placeholder="How did the booking go?"
                    ></textarea>
                  </div>

                  <button class="primary-button" type="submit">Submit review</button>
                </form>
              }
            </article>
          }
        </div>

        @if (bookings().as_client.length > pageSize) {
          <div class="dashboard-pagination">
            <span class="muted">
              Showing {{ pageStart(bookings().as_client.length, clientPage()) }} to
              {{ pageEnd(bookings().as_client.length, clientPage()) }} of
              {{ bookings().as_client.length }}
            </span>
            <div class="actions-row">
              <button
                class="ghost-button"
                type="button"
                (click)="previousClientPage()"
                [disabled]="clientPage() === 0"
              >
                Previous 10
              </button>
              <button
                class="ghost-button"
                type="button"
                (click)="nextClientPage()"
                [disabled]="!hasNextPage(bookings().as_client.length, clientPage())"
              >
                Next 10
              </button>
            </div>
          </div>
        }
      </section>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPageComponent {
  private readonly api = inject(MarketplaceService);
  private readonly router = inject(Router);
  readonly pageSize = 10;
  readonly auth = inject(AuthService);

  readonly categories = signal<Category[]>([]);
  readonly myServices = signal<Service[]>([]);
  readonly bookings = signal<MyBookingsResponse>({ as_client: [], as_provider: [] });
  readonly error = signal('');
  readonly success = signal('');
  readonly providerPage = signal(0);
  readonly clientPage = signal(0);
  readonly activeListingCount = computed(
    () => this.myServices().filter((service) => service.is_active).length,
  );
  readonly pendingProviderCount = computed(
    () => this.bookings().as_provider.filter((booking) => booking.status === 'pending').length,
  );
  readonly waitingReviewCount = computed(
    () => this.bookings().as_client.filter((booking) => booking.can_review).length,
  );
  readonly providerBookingsPage = computed(() =>
    this.paginateItems(this.bookings().as_provider, this.providerPage()),
  );
  readonly clientBookingsPage = computed(() =>
    this.paginateItems(this.bookings().as_client, this.clientPage()),
  );

  private readonly reviewDrafts: Record<number, ReviewDraft> = {};

  constructor() {
    const successMessage = this.router.getCurrentNavigation()?.extras.state?.['successMessage'];
    if (typeof successMessage === 'string') {
      this.success.set(successMessage);
    }

    this.loadDashboard();
  }

  changeBookingStatus(booking: Booking, status: Booking['status']): void {
    this.error.set('');
    this.success.set('');

    this.api.updateBookingStatus(booking.id, status).subscribe({
      next: (updatedBooking) => {
        this.success.set(this.bookingStatusSuccessMessage(updatedBooking, status));
        this.loadDashboard();
      },
      error: (error) => {
        this.error.set(formatApiError(error));
      },
    });
  }

  submitReview(bookingId: number): void {
    const draft = this.reviewDraft(bookingId);
    this.error.set('');
    this.success.set('');

    this.api
      .createReview({
        booking: bookingId,
        rating: draft.rating,
        comment: draft.comment,
      })
      .subscribe({
        next: () => {
          this.success.set('Review submitted.');
          delete this.reviewDrafts[bookingId];
          this.loadDashboard();
        },
        error: (error) => {
          this.error.set(formatApiError(error));
        },
      });
  }

  reviewDraft(bookingId: number): ReviewDraft {
    this.reviewDrafts[bookingId] ??= { rating: 5, comment: '' };
    return this.reviewDrafts[bookingId];
  }

  providerCompletionSummary(booking: Booking): string {
    if (booking.status === 'completed') {
      return 'Confirmed by both executive and client.';
    }

    if (booking.provider_completion_confirmed) {
      return 'You confirmed completion. Waiting for the client.';
    }

    return 'Confirm completion when the work is delivered.';
  }

  clientCompletionSummary(booking: Booking): string {
    if (booking.status === 'completed') {
      return 'Confirmed by both executive and client.';
    }

    if (booking.provider_completion_confirmed) {
      return 'The executive confirmed completion. You can confirm now.';
    }

    return 'Waiting for the executive to confirm completion first.';
  }

  reviewAvailabilitySummary(booking: Booking): string {
    if (booking.review) {
      return 'Already submitted';
    }

    if (booking.can_review) {
      return 'Available now';
    }

    if (booking.provider_completion_confirmed) {
      return 'Unlocks after you confirm completion';
    }

    return 'Locked until the executive confirms completion';
  }

  previousProviderPage(): void {
    this.providerPage.update((page) => Math.max(0, page - 1));
  }

  nextProviderPage(): void {
    if (!this.hasNextPage(this.bookings().as_provider.length, this.providerPage())) {
      return;
    }

    this.providerPage.update((page) => page + 1);
  }

  previousClientPage(): void {
    this.clientPage.update((page) => Math.max(0, page - 1));
  }

  nextClientPage(): void {
    if (!this.hasNextPage(this.bookings().as_client.length, this.clientPage())) {
      return;
    }

    this.clientPage.update((page) => page + 1);
  }

  hasNextPage(totalItems: number, currentPage: number): boolean {
    return (currentPage + 1) * this.pageSize < totalItems;
  }

  pageStart(totalItems: number, currentPage: number): number {
    if (totalItems === 0) {
      return 0;
    }

    return currentPage * this.pageSize + 1;
  }

  pageEnd(totalItems: number, currentPage: number): number {
    return Math.min((currentPage + 1) * this.pageSize, totalItems);
  }

  private loadDashboard(): void {
    forkJoin({
      categories: this.api.getCategories(),
      services: this.api.getMyServices(),
      bookings: this.api.getMyBookings(),
    }).subscribe({
      next: ({ categories, services, bookings }) => {
        this.categories.set(categories);
        this.myServices.set(services);
        this.bookings.set(bookings);
        this.providerPage.set(this.clampPage(this.providerPage(), bookings.as_provider.length));
        this.clientPage.set(this.clampPage(this.clientPage(), bookings.as_client.length));
      },
      error: (error) => {
        this.error.set(formatApiError(error));
      },
    });
  }

  private bookingStatusSuccessMessage(booking: Booking, nextStatus: Booking['status']): string {
    if (nextStatus === 'accepted') {
      return 'Booking accepted.';
    }

    if (booking.status === 'completed') {
      return 'Booking completed.';
    }

    if (booking.user_role === 'provider') {
      return 'Completion confirmed. Waiting for the client.';
    }

    return 'Completion confirmed.';
  }

  private paginateItems<T>(items: T[], currentPage: number): T[] {
    const start = currentPage * this.pageSize;
    return items.slice(start, start + this.pageSize);
  }

  private clampPage(currentPage: number, totalItems: number): number {
    if (totalItems <= this.pageSize) {
      return 0;
    }

    return Math.min(currentPage, Math.floor((totalItems - 1) / this.pageSize));
  }
}
