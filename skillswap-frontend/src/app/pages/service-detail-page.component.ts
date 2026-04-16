import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { formatApiError } from '../core/api-error';
import { AuthService } from '../core/auth.service';
import { Category, ServiceDetail, ServiceWritePayload } from '../core/models';
import { MarketplaceService } from '../core/marketplace.service';

@Component({
  selector: 'app-service-detail-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    @if (service(); as currentService) {
      <section class="stack-2xl service-detail-page">
        <div class="hero-split">
          <div class="panel hero-panel stack-xl service-hero-panel">
            <div class="chip-row">
              <span class="badge">{{ currentService.category.name }}</span>
              <span class="status-pill" [class.status-muted]="!currentService.is_active">
                {{ currentService.is_active ? 'Active listing' : 'Paused listing' }}
              </span>
            </div>

            <div class="stack-lg">
              <h1 class="service-detail-title">{{ currentService.title }}</h1>
              <p class="lede service-detail-lede">{{ currentService.summary }}</p>
            </div>

            <div class="seller-row service-owner-row">
              <span class="avatar">{{ currentService.owner.display_name.charAt(0) }}</span>
              <div>
                <strong>{{ currentService.owner.display_name }}</strong>
                <p class="muted">
                  {{ currentService.owner.location || currentService.location }} •
                  {{ currentService.created_at | date:'mediumDate' }}
                </p>
              </div>
            </div>

            <div class="metric-grid service-metric-grid">
              <div class="metric-card">
                <strong>{{ currentService.price | currency:'KZT ':'symbol':'1.0-0' }}</strong>
                <span>Starting price</span>
              </div>
              <div class="metric-card">
                <strong>{{ currentService.average_rating ?? 'New' }}</strong>
                <span>Average rating</span>
              </div>
              <div class="metric-card">
                <strong>{{ currentService.review_count }}</strong>
                <span>Completed reviews</span>
              </div>
            </div>
          </div>

          <aside class="panel sidebar-card stack-lg service-side-panel">
            @if (isOwner()) {
              <div class="stack-md">
                <p class="eyebrow">Listing controls</p>
                <h2>Manage your service</h2>
                <p class="muted">Update the offer details below or pause the listing when needed.</p>
              </div>

              <div class="owner-summary-grid">
                <div class="owner-summary-card">
                  <strong>{{ currentService.review_count }}</strong>
                  <span>Reviews</span>
                </div>
                <div class="owner-summary-card">
                  <strong>{{ currentService.is_active ? 'Live' : 'Paused' }}</strong>
                  <span>Status</span>
                </div>
                <div class="owner-summary-card">
                  <strong>{{ currentService.location }}</strong>
                  <span>Delivery location</span>
                </div>
              </div>

              <div class="owner-sidebar-note">
                <strong>Editing below updates the live listing.</strong>
                <p class="muted">
                  Keep the title, price, summary, and visibility accurate so the marketplace card
                  stays easy to trust at a glance.
                </p>
              </div>
            } @else {
              <div class="stack-md">
                <p class="eyebrow">Ready to book?</p>
                <h2>{{ currentService.price | currency:'KZT ':'symbol':'1.0-0' }}</h2>
                <p class="muted">
                  Book this service, keep all messages in the booking chat, and review it
                  once the work is completed.
                </p>
              </div>

              @if (!auth.isAuthenticated()) {
                <div class="stack-md">
                  <p class="muted">You need an account before placing a booking request.</p>
                  <a class="primary-button" routerLink="/login">Log in or sign up</a>
                </div>
              } @else if (!currentService.can_book) {
                <p class="status-pill status-muted">You cannot book your own listing.</p>
              } @else {
                <form class="stack-lg service-booking-form" (ngSubmit)="bookService()">
                  <div class="field">
                    <label for="booking-date">Preferred date</label>
                    <input
                      id="booking-date"
                      type="datetime-local"
                      name="bookingDate"
                      [(ngModel)]="bookingForm.scheduled_for"
                    />
                  </div>

                  <div class="field">
                    <label for="booking-note">Project note</label>
                    <textarea
                      id="booking-note"
                      name="bookingNote"
                      [(ngModel)]="bookingForm.note"
                      placeholder="Describe the work you need done"
                    ></textarea>
                  </div>

                  <p class="field-note">
                    Give a short scope or expected outcome so the provider can accept faster.
                  </p>

                  <button class="primary-button" type="submit" [disabled]="bookingBusy()">
                    {{ bookingBusy() ? 'Sending request...' : 'Request booking' }}
                  </button>
                </form>
              }
            }
          </aside>
        </div>

        @if (error()) {
          <p class="error-banner">{{ error() }}</p>
        }

        @if (success()) {
          <p class="success-banner">{{ success() }}</p>
        }

        @if (isOwner()) {
          <section class="panel stack-lg service-edit-panel service-edit-panel-full">
            <div class="stack-md">
              <p class="eyebrow">Edit listing</p>
              <h2>Update service details</h2>
              <p class="muted">This keeps your marketplace card and booking flow up to date.</p>
            </div>

            <form class="stack-lg service-edit-form service-edit-form-full" (ngSubmit)="saveService()">
              <div class="service-edit-grid">
                <div class="field">
                  <label for="edit-category">Category</label>
                  <select
                    id="edit-category"
                    name="editCategory"
                    [(ngModel)]="editForm.category"
                    required
                  >
                    <option [ngValue]="0" disabled>Select a category</option>
                    @for (category of categories(); track category.id) {
                      <option [ngValue]="category.id">{{ category.name }}</option>
                    }
                  </select>
                </div>

                <div class="field">
                  <label for="edit-title">Title</label>
                  <input id="edit-title" name="editTitle" [(ngModel)]="editForm.title" required />
                </div>

                <div class="field service-edit-span-full">
                  <label for="edit-summary">Summary</label>
                  <textarea
                    id="edit-summary"
                    name="editSummary"
                    [(ngModel)]="editForm.summary"
                    required
                  ></textarea>
                </div>

                <div class="field service-edit-span-full">
                  <label for="edit-description">Description</label>
                  <textarea
                    id="edit-description"
                    name="editDescription"
                    [(ngModel)]="editForm.description"
                    required
                  ></textarea>
                </div>

                <div class="field">
                  <label for="edit-price">Price (KZT)</label>
                  <input
                    id="edit-price"
                    type="number"
                    min="0"
                    name="editPrice"
                    [(ngModel)]="editForm.price"
                    required
                  />
                </div>

                <div class="field">
                  <label for="edit-location">Location</label>
                  <input
                    id="edit-location"
                    name="editLocation"
                    [(ngModel)]="editForm.location"
                    required
                  />
                </div>

                <label class="checkbox-row service-visibility-toggle service-edit-span-full">
                  <input type="checkbox" name="editActive" [(ngModel)]="editForm.is_active" />
                  <span>
                    <strong>Listing is active</strong>
                    <small>Paused listings stay editable but are hidden from other users.</small>
                  </span>
                </label>
              </div>

              <div class="actions-row service-form-actions">
                <button class="primary-button" type="submit" [disabled]="saving()">
                  {{ saving() ? 'Saving...' : 'Save changes' }}
                </button>
                <button class="danger-button" type="button" (click)="deleteService()" [disabled]="saving()">
                  Delete listing
                </button>
              </div>
            </form>
          </section>

        } @else {
          <div class="detail-layout">
            <aside class="panel soft stack-lg">
              <div class="stack-md">
                <p class="eyebrow">Why clients and executives use SkillSwap</p>
                <h2>A booking stays connected from discovery to delivery.</h2>
              </div>
              <p class="muted">
                Whether the request starts with a client brief or an executive ask, the provider
                can accept it, chat stays limited to both participants, and the review only
                unlocks after the work is marked complete.
              </p>
              <a class="secondary-button" routerLink="/services">Browse more services</a>
            </aside>
          </div>
        }

        <section class="section-shell">
          <div class="section-header">
            <div class="stack-md">
              <p class="eyebrow">Reviews</p>
              <h2>Client feedback</h2>
            </div>
            <span class="metric-pill">{{ currentService.review_count }} total</span>
          </div>

          @if (currentService.reviews.length === 0) {
            <div class="empty-state">
              <p>No reviews yet. The first completed booking will show up here.</p>
            </div>
          }

          <div class="listing-grid">
            @for (review of currentService.reviews; track review.id) {
              <article class="review-card">
                <div class="seller-row">
                  <span class="avatar">{{ review.reviewer.display_name.charAt(0) }}</span>
                  <div>
                    <strong>{{ review.reviewer.display_name }}</strong>
                    <p class="muted">{{ review.created_at | date:'medium' }}</p>
                  </div>
                </div>
                <div class="badge">{{ review.rating }}/5</div>
                <p>{{ review.comment || 'No written comment provided.' }}</p>
              </article>
            }
          </div>
        </section>
      </section>
    } @else {
      <div class="empty-state">
        <h2>Service not found.</h2>
        <a class="primary-button" routerLink="/services">Back to marketplace</a>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(MarketplaceService);
  readonly auth = inject(AuthService);

  readonly service = signal<ServiceDetail | null>(null);
  readonly categories = signal<Category[]>([]);
  readonly error = signal('');
  readonly success = signal('');
  readonly bookingBusy = signal(false);
  readonly saving = signal(false);

  readonly bookingForm = {
    scheduled_for: '',
    note: '',
  };

  readonly editForm = {
    category: 0,
    title: '',
    summary: '',
    description: '',
    price: '',
    location: '',
    is_active: true,
  };

  constructor() {
    this.loadPage();
  }

  isOwner(): boolean {
    return this.auth.currentUser()?.id === this.service()?.owner.id;
  }

  bookService(): void {
    const currentService = this.service();
    if (!currentService) {
      return;
    }

    this.error.set('');
    this.success.set('');
    this.bookingBusy.set(true);

    this.api
      .createBooking({
        service: currentService.id,
        scheduled_for: this.bookingForm.scheduled_for
          ? new Date(this.bookingForm.scheduled_for).toISOString()
          : null,
        note: this.bookingForm.note,
      })
      .subscribe({
        next: () => {
          this.bookingBusy.set(false);
          this.bookingForm.note = '';
          this.bookingForm.scheduled_for = '';
          this.success.set('Booking request sent. You can track it from the dashboard.');
        },
        error: (error) => {
          this.bookingBusy.set(false);
          this.error.set(formatApiError(error));
        },
      });
  }

  saveService(): void {
    const currentService = this.service();
    if (!currentService) {
      return;
    }

    this.error.set('');
    this.success.set('');
    this.saving.set(true);

    const payload: ServiceWritePayload = {
      category: Number(this.editForm.category),
      title: this.editForm.title,
      summary: this.editForm.summary,
      description: this.editForm.description,
      price: this.editForm.price,
      location: this.editForm.location,
      is_active: this.editForm.is_active,
    };

    this.api.updateService(currentService.id, payload).subscribe({
      next: (service) => {
        this.saving.set(false);
        this.success.set('Listing updated.');
        this.applyService(service);
      },
      error: (error) => {
        this.saving.set(false);
        this.error.set(formatApiError(error));
      },
    });
  }

  deleteService(): void {
    const currentService = this.service();
    if (!currentService || !window.confirm('Delete this listing? This cannot be undone.')) {
      return;
    }

    this.saving.set(true);
    this.api.deleteService(currentService.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.router.navigateByUrl('/services');
      },
      error: (error) => {
        this.saving.set(false);
        this.error.set(formatApiError(error));
      },
    });
  }

  private loadPage(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      return;
    }

    forkJoin({
      service: this.api.getService(id),
      categories: this.api.getCategories(),
    }).subscribe({
      next: ({ service, categories }) => {
        this.categories.set(categories);
        this.applyService(service);
      },
      error: (error) => {
        this.error.set(formatApiError(error));
      },
    });
  }

  private applyService(service: ServiceDetail): void {
    this.service.set(service);
    this.editForm.category = service.category.id;
    this.editForm.title = service.title;
    this.editForm.summary = service.summary;
    this.editForm.description = service.description;
    this.editForm.price = service.price;
    this.editForm.location = service.location;
    this.editForm.is_active = service.is_active;
  }
}
