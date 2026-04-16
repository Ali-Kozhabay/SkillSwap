import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  Booking,
  BookingCreatePayload,
  Category,
  Message,
  MyBookingsResponse,
  Review,
  ReviewCreatePayload,
  Service,
  ServiceDetail,
  ServiceWritePayload,
} from './models';

@Injectable({ providedIn: 'root' })
export class MarketplaceService {
  private readonly http = inject(HttpClient);

  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>('/api/categories/');
  }

  listServices(filters: { search?: string; category?: string | number | null }): Observable<Service[]> {
    let params = new HttpParams();

    if (filters.search) {
      params = params.set('search', filters.search.trim());
    }

    if (filters.category) {
      params = params.set('category', String(filters.category));
    }

    return this.http.get<Service[]>('/api/services/', { params });
  }

  getService(id: number): Observable<ServiceDetail> {
    return this.http.get<ServiceDetail>(`/api/services/${id}/`);
  }

  getMyServices(): Observable<Service[]> {
    return this.http.get<Service[]>('/api/services/mine/');
  }

  createService(payload: ServiceWritePayload): Observable<Service> {
    return this.http.post<Service>('/api/services/', payload);
  }

  updateService(id: number, payload: ServiceWritePayload): Observable<ServiceDetail> {
    return this.http.patch<ServiceDetail>(`/api/services/${id}/`, payload);
  }

  deleteService(id: number): Observable<void> {
    return this.http.delete<void>(`/api/services/${id}/`);
  }

  createBooking(payload: BookingCreatePayload): Observable<Booking> {
    return this.http.post<Booking>('/api/bookings/', payload);
  }

  getMyBookings(): Observable<MyBookingsResponse> {
    return this.http.get<MyBookingsResponse>('/api/bookings/my/');
  }

  getBooking(id: number): Observable<Booking> {
    return this.http.get<Booking>(`/api/bookings/${id}/`);
  }

  updateBookingStatus(id: number, status: Booking['status']): Observable<Booking> {
    return this.http.patch<Booking>(`/api/bookings/${id}/status/`, { status });
  }

  getMessages(bookingId: number): Observable<Message[]> {
    return this.http.get<Message[]>(`/api/bookings/${bookingId}/messages/`);
  }

  getBookingChatSocketUrl(bookingId: number): string {
    if (typeof window === 'undefined') {
      return '';
    }

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host =
      window.location.port === '4200'
        ? `${window.location.hostname}:8000`
        : window.location.host;

    return `${protocol}://${host}/ws/bookings/${bookingId}/chat/`;
  }

  sendMessage(bookingId: number, text: string): Observable<Message> {
    return this.http.post<Message>('/api/messages/', { booking: bookingId, text });
  }

  createReview(payload: ReviewCreatePayload): Observable<Review> {
    return this.http.post<Review>('/api/reviews/', payload);
  }
}
