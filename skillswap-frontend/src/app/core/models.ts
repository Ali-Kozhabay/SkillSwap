export interface UserSummary {
  id: number;
  username: string;
  display_name: string;
  first_name: string;
  last_name: string;
  location: string;
  bio: string;
}

export interface CurrentUser extends UserSummary {
  email: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
}

export interface Review {
  id: number;
  rating: number;
  comment: string;
  created_at: string;
  reviewer: UserSummary;
}

export interface Service {
  id: number;
  title: string;
  summary: string;
  description: string;
  price: string;
  location: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  owner: UserSummary;
  category: Category;
  average_rating: number | null;
  review_count: number;
  can_book: boolean;
}

export interface ServiceDetail extends Service {
  reviews: Review[];
}

export type BookingCompensationType = 'money' | 'service';

export interface Booking {
  id: number;
  service: Service;
  compensation_type: BookingCompensationType;
  offered_service: Service | null;
  client: UserSummary;
  provider: UserSummary;
  status: 'pending' | 'accepted' | 'completed';
  provider_completion_confirmed: boolean;
  client_completion_confirmed: boolean;
  scheduled_for: string | null;
  note: string;
  created_at: string;
  updated_at: string;
  user_role: 'client' | 'provider' | 'guest';
  can_review: boolean;
  review: Review | null;
}

export interface MyBookingsResponse {
  as_client: Booking[];
  as_provider: Booking[];
}

export interface Message {
  id: number;
  booking: number;
  sender: UserSummary;
  text: string;
  created_at: string;
}

export interface AuthResponse {
  user: CurrentUser;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  confirm_password: string;
  first_name: string;
  last_name: string;
  location: string;
  bio: string;
}

export interface ServiceWritePayload {
  category: number;
  title: string;
  summary: string;
  description: string;
  price: string;
  location: string;
  is_active: boolean;
}

export interface BookingCreatePayload {
  service: number;
  compensation_type: BookingCompensationType;
  offered_service: number | null;
  note: string;
}

export interface ReviewCreatePayload {
  booking: number;
  rating: number;
  comment: string;
}
