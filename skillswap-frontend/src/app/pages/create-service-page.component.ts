import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { formatApiError } from '../core/api-error';
import { Category, ServiceWritePayload } from '../core/models';
import { MarketplaceService } from '../core/marketplace.service';

@Component({
  selector: 'app-create-service-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="stack-2xl">
      <section class="panel hero-panel stack-lg">
        <div class="section-header">
          <div class="stack-md">
            <p class="eyebrow">Create a service</p>
            <h1 class="dashboard-hero-title">Publish a new listing.</h1>
            <p class="lede">
              Build the offer on its own page, save it once, and return to the dashboard after it
              is live.
            </p>
          </div>
          <a class="ghost-button" routerLink="/dashboard">Back to dashboard</a>
        </div>

        <div class="chip-row">
          <span class="metric-pill">Appears on marketplace cards</span>
          <span class="metric-pill">Booking chat opens after acceptance</span>
          <span class="metric-pill">Reviews unlock after completion</span>
        </div>
      </section>

      @if (error()) {
        <p class="error-banner">{{ error() }}</p>
      }

      <div class="dashboard-main-grid">
        <section class="panel stack-lg">
          <div class="stack-md">
            <p class="eyebrow">Service details</p>
            <h2>Listing builder</h2>
            <p class="muted">
              Fill out the core offer here, then save it back into the marketplace.
            </p>
          </div>

          <form class="stack-lg dashboard-form" (ngSubmit)="createService()">
            <div class="field">
              <label for="create-title">Title</label>
              <input
                id="create-title"
                name="createTitle"
                [(ngModel)]="createForm.title"
                placeholder="Example: Executive operations support for remote teams"
                required
              />
            </div>

            <div class="grid-2">
              <div class="field">
                <label for="create-category">Category</label>
                <select
                  id="create-category"
                  name="createCategory"
                  [(ngModel)]="createForm.category"
                  required
                >
                  <option [ngValue]="0" disabled>Select a category</option>
                  @for (category of categories(); track category.id) {
                    <option [ngValue]="category.id">{{ category.name }}</option>
                  }
                </select>
              </div>

              <div class="field">
                <label for="create-location">Location</label>
                <input
                  id="create-location"
                  name="createLocation"
                  [(ngModel)]="createForm.location"
                  placeholder="Remote, Astana, Almaty, etc."
                  required
                />
              </div>
            </div>

            <div class="field">
              <label for="create-summary">Summary</label>
              <textarea
                id="create-summary"
                class="dashboard-summary-input"
                name="createSummary"
                [(ngModel)]="createForm.summary"
                placeholder="A short summary clients can compare quickly."
                required
              ></textarea>
            </div>

            <div class="field">
              <label for="create-description">Description</label>
              <textarea
                id="create-description"
                name="createDescription"
                [(ngModel)]="createForm.description"
                placeholder="Explain deliverables, scope, and what happens after booking."
                required
              ></textarea>
            </div>

            <div class="dashboard-form-footer">
              <div class="dashboard-inline-fields">
                <div class="field">
                  <label for="create-price">Price (KZT)</label>
                  <input
                    id="create-price"
                    type="number"
                    min="0"
                    name="createPrice"
                    [(ngModel)]="createForm.price"
                    required
                  />
                </div>

                <label class="dashboard-toggle-card checkbox-row">
                  <input type="checkbox" name="createActive" [(ngModel)]="createForm.is_active" />
                  <span>
                    <strong>Publish immediately</strong>
                    <small>Keep the listing visible as soon as it is created.</small>
                  </span>
                </label>
              </div>

              <div class="dashboard-form-actions">
                <p class="dashboard-form-note">
                  Clear titles, a short summary, and a specific location make the card easier to
                  trust at a glance.
                </p>
                <div class="actions-row">
                  <a class="ghost-button" routerLink="/dashboard">Cancel</a>
                  <button class="primary-button" type="submit" [disabled]="creating()">
                    {{ creating() ? 'Saving...' : 'Save service' }}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </section>

        <aside class="panel soft stack-lg dashboard-guide-panel">
          <div class="stack-md">
            <p class="eyebrow">What to write</p>
            <h2>Keep the listing clear</h2>
            <p class="muted">
              Strong service cards read quickly, feel specific, and make the next booking step easy.
            </p>
          </div>

          <div class="dashboard-flow-list">
            <article class="dashboard-flow-card">
              <span class="dashboard-flow-step">1</span>
              <div>
                <h3>Lead with the outcome</h3>
                <p class="muted">
                  Use a title and summary that tell buyers what you actually deliver.
                </p>
              </div>
            </article>
            <article class="dashboard-flow-card">
              <span class="dashboard-flow-step">2</span>
              <div>
                <h3>Describe the scope</h3>
                <p class="muted">
                  The description should explain the work, the boundaries, and the handoff.
                </p>
              </div>
            </article>
            <article class="dashboard-flow-card">
              <span class="dashboard-flow-step">3</span>
              <div>
                <h3>Set a realistic price</h3>
                <p class="muted">
                  Keep pricing and location accurate so the first booking request is qualified.
                </p>
              </div>
            </article>
          </div>
        </aside>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateServicePageComponent {
  private readonly api = inject(MarketplaceService);
  private readonly router = inject(Router);

  readonly categories = signal<Category[]>([]);
  readonly creating = signal(false);
  readonly error = signal('');

  readonly createForm = {
    category: 0,
    title: '',
    summary: '',
    description: '',
    price: '',
    location: '',
    is_active: true,
  };

  constructor() {
    this.api.getCategories().subscribe({
      next: (categories) => {
        this.categories.set(categories);
      },
      error: (error) => {
        this.error.set(formatApiError(error));
      },
    });
  }

  createService(): void {
    this.error.set('');
    this.creating.set(true);

    const payload: ServiceWritePayload = {
      category: Number(this.createForm.category),
      title: this.createForm.title,
      summary: this.createForm.summary,
      description: this.createForm.description,
      price: this.createForm.price,
      location: this.createForm.location,
      is_active: this.createForm.is_active,
    };

    this.api.createService(payload).subscribe({
      next: () => {
        this.creating.set(false);
        this.router.navigate(['/dashboard'], {
          state: { successMessage: 'Listing created.' },
        });
      },
      error: (error) => {
        this.creating.set(false);
        this.error.set(formatApiError(error));
      },
    });
  }
}
