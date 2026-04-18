import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';

import { formatApiError } from '../core/api-error';
import { AuthService } from '../core/auth.service';
import { Category, Service } from '../core/models';
import { MarketplaceService } from '../core/marketplace.service';
import { renderStars } from '../core/rating';

@Component({
  selector: 'app-services-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="stack-2xl">
      <section class="panel hero-panel stack-xl">
        <div class="stack-lg">
          <p class="eyebrow">For clients, executives, and independent experts</p>
          <h1>Find the right service faster.</h1>
          <p class="lede">
            Search by keyword, tap a category, and open a service to book it. SkillSwap is tuned
            for client delivery, executive requests, and specialist work without turning discovery
            into a complicated filter form.
          </p>
        </div>

        <div class="audience-row">
          @for (audience of audiences; track audience.title) {
            <article class="audience-card">
              <span class="audience-kicker">{{ audience.kicker }}</span>
              <strong>{{ audience.title }}</strong>
              <p>{{ audience.description }}</p>
            </article>
          }
        </div>

        <form class="simple-search" (ngSubmit)="loadCatalog()">
          <div class="simple-search-bar">
            <input
              id="search"
              name="search"
              [(ngModel)]="filters.search"
              placeholder="What service are you looking for?"
            />
            <button class="primary-button" type="submit" [disabled]="loading()">
              {{ loading() ? 'Searching...' : 'Search' }}
            </button>
            <button class="ghost-button" type="button" (click)="clearFilters()">
              Reset
            </button>
          </div>
        </form>

        <div class="stack-md">
          <div class="search-chip-row">
            <button
              class="filter-chip"
              type="button"
              [class.is-active]="!filters.category"
              (click)="chooseCategory('')"
            >
              All
            </button>
            @for (category of categories(); track category.id) {
              <button
                class="filter-chip"
                type="button"
                [class.is-active]="filters.category === category.id.toString()"
                (click)="chooseCategory(category.id)"
              >
                {{ category.name }}
              </button>
            }
          </div>

          <p class="search-summary">
            Showing {{ services().length }} service{{ services().length === 1 ? '' : 's' }}
            @if (filters.search) {
              for "<strong>{{ filters.search }}</strong>"
            }
          </p>
        </div>
      </section>

      @if (error()) {
        <p class="error-banner">{{ error() }}</p>
      }

      <section class="section-shell">
        <div class="section-header">
          <div class="stack-md">
            <p class="eyebrow">Featured services</p>
            <h2>Explore active listings</h2>
            <p>Every card below is wired to your real SkillSwap service data.</p>
          </div>
        </div>

        @if (!loading() && services().length === 0) {
          <div class="empty-state">
            <h3>No services match this filter.</h3>
            <p>Try a broader search or remove the category filter.</p>
          </div>
        }

        <div class="listing-grid">
          @for (service of services(); track service.id) {
            <article class="listing-card">
              <div class="listing-head">
                <div class="seller-row">
                  <span class="avatar">{{ service.owner.display_name.charAt(0) }}</span>
                  <div>
                    <strong>{{ service.owner.display_name }}</strong>
                    <p class="muted">{{ service.location }}</p>
                  </div>
                </div>

                <div class="price-block">
                  <span class="price-label">Starting at</span>
                  <div class="price-value">{{ service.price | currency:'KZT ':'symbol':'1.0-0' }}</div>
                </div>
              </div>

              <div class="chip-row">
                <span class="badge">{{ service.category.name }}</span>
                @if (service.average_rating !== null) {
                  <span class="metric-pill rating-pill">
                    <span class="rating-stars">{{ renderStars(service.average_rating) }}</span>
                    <span class="rating-meta">
                      {{ service.average_rating | number:'1.1-1' }} ·
                      {{ service.review_count }} review{{ service.review_count === 1 ? '' : 's' }}
                    </span>
                  </span>
                } @else {
                  <span class="metric-pill">New listing</span>
                }
              </div>

              <div class="stack-md">
                <div>
                  <h3>{{ service.title }}</h3>
                  <p class="muted">{{ service.summary }}</p>
                </div>
                <p>{{ service.description }}</p>
              </div>

              <div class="mini-divider"></div>

              <div class="actions-row">
                <a class="primary-button" [routerLink]="['/service', service.id]">View details</a>
                @if (!auth.isAuthenticated()) {
                  <a class="ghost-button" routerLink="/login">Log in to book</a>
                } @else if (service.can_book) {
                  <a class="ghost-button" [routerLink]="['/service', service.id]">Book now</a>
                } @else {
                  <span class="status-pill status-muted">Your listing</span>
                }
              </div>
            </article>
          }
        </div>
      </section>

      <section class="panel stack-lg">
        <div class="section-header">
          <div class="stack-md">
            <p class="eyebrow">How it works</p>
            <h2>Move from search to completed work without leaving the marketplace.</h2>
          </div>
        </div>

        <div class="process-grid">
          <article class="process-card">
            <h3>Search and compare</h3>
            <p class="muted">
              Browse live services, filter by category, and compare pricing, rating, and location.
            </p>
          </article>
          <article class="process-card">
            <h3>Book with clarity</h3>
            <p class="muted">
              Request a booking with timing and context so the provider can accept the work fast.
            </p>
          </article>
          <article class="process-card">
            <h3>Chat and review</h3>
            <p class="muted">
              Keep messaging inside the booking and leave a rating once the work is completed.
            </p>
          </article>
        </div>
      </section>

      <section class="value-banner">
        <div class="section-header">
          <div class="stack-md">
            <p class="eyebrow">Built on your full-stack app</p>
            <h2>SkillSwap now feels closer to a real hiring marketplace.</h2>
            <p class="muted">
              The frontend keeps your Angular routes and backend APIs, but the presentation is now
              much closer to an Upwork-style marketplace landing experience.
            </p>
          </div>
          <a class="secondary-button" [routerLink]="auth.isAuthenticated() ? '/dashboard' : '/login'">
            {{ auth.isAuthenticated() ? 'Go to dashboard' : 'Create account' }}
          </a>
        </div>

        <div class="metric-grid">
          <div class="metric-card">
            <strong>Search</strong>
            <span>Title and category filtering from the hero.</span>
          </div>
          <div class="metric-card">
            <strong>Trust</strong>
            <span>Ratings and reviews shown directly on service discovery cards.</span>
          </div>
          <div class="metric-card">
            <strong>Workflow</strong>
            <span>Bookings, messaging, and reviews stay linked end to end.</span>
          </div>
        </div>
      </section>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicesPageComponent {
  private readonly api = inject(MarketplaceService);
  readonly auth = inject(AuthService);
  readonly renderStars = renderStars;

  readonly services = signal<Service[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly audiences = [
    {
      kicker: 'Clients',
      title: 'Ship delivery work faster',
      description: 'Shortlist proven specialists for project overflow, retainers, and one-off asks.',
    },
    {
      kicker: 'Executives',
      title: 'Book trusted support directly',
      description: 'Use the marketplace for research, ops help, and urgent requests without email loops.',
    },
    {
      kicker: 'Experts',
      title: 'Turn expertise into bookable offers',
      description: 'Package your work clearly so decision-makers can move from search to booking fast.',
    },
  ];

  readonly filters = {
    search: '',
    category: '',
  };

  constructor() {
    this.loadCatalog();
  }

  chooseCategory(categoryId: string | number): void {
    this.filters.category = String(categoryId);
    this.loadCatalog();
  }

  clearFilters(): void {
    this.filters.search = '';
    this.filters.category = '';
    this.loadCatalog();
  }

  loadCatalog(): void {
    this.loading.set(true);
    this.error.set('');

    const categories$ = this.categories().length ? of(this.categories()) : this.api.getCategories();

    forkJoin({
      categories: categories$,
      services: this.api.listServices(this.filters),
    }).subscribe({
      next: ({ categories, services }) => {
        this.categories.set(categories);
        this.services.set(services);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.error.set(formatApiError(error));
      },
    });
  }
}
