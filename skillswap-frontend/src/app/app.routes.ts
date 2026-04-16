import { Routes } from '@angular/router';

import { authGuard } from './core/auth.guard';
import { AuthPageComponent } from './pages/auth-page.component';
import { ChatPageComponent } from './pages/chat-page.component';
import { CreateServicePageComponent } from './pages/create-service-page.component';
import { DashboardPageComponent } from './pages/dashboard-page.component';
import { ServiceDetailPageComponent } from './pages/service-detail-page.component';
import { ServicesPageComponent } from './pages/services-page.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'services' },
  { path: 'login', component: AuthPageComponent },
  { path: 'services', component: ServicesPageComponent },
  { path: 'service/:id', component: ServiceDetailPageComponent },
  { path: 'dashboard/services/new', component: CreateServicePageComponent, canActivate: [authGuard] },
  { path: 'dashboard', component: DashboardPageComponent, canActivate: [authGuard] },
  { path: 'chat/:bookingId', component: ChatPageComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: 'services' },
];
