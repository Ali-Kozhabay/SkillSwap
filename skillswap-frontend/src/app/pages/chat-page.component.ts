import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { formatApiError } from '../core/api-error';
import { Booking, Message } from '../core/models';
import { MarketplaceService } from '../core/marketplace.service';

type ChatConnectionState = 'connecting' | 'live' | 'reconnecting' | 'offline';

@Component({
  selector: 'app-chat-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    @if (booking(); as currentBooking) {
      <section class="stack-2xl">
        <div class="hero-split">
          <div class="panel hero-panel stack-lg">
            <p class="eyebrow">Live booking conversation</p>
            <h1>{{ currentBooking.service.title }}</h1>
            <p class="lede">
              Real-time chat stays locked to the booking participants so the client, executive,
              delivery notes, and next steps stay together in one thread.
            </p>

            <div class="metric-grid">
              <div class="metric-card">
                <strong>{{ currentBooking.status }}</strong>
                <span>Booking status</span>
              </div>
              <div class="metric-card">
                <strong>{{ currentBooking.client.display_name }}</strong>
                <span>Client</span>
              </div>
              <div class="metric-card">
                <strong>{{ currentBooking.provider.display_name }}</strong>
                <span>Executive</span>
              </div>
            </div>
          </div>

          <aside class="panel sidebar-card stack-md">
            <p class="eyebrow">Booking context</p>
            <h2>Project details</h2>
            <p><strong>Compensation:</strong>
              @if (currentBooking.compensation_type === 'service') {
                {{ currentBooking.offered_service?.title || 'Service swap offer attached.' }}
              } @else {
                {{ currentBooking.service.price | currency:'KZT ':'symbol':'1.0-0' }}
              }
            </p>
            <p><strong>Booking note:</strong> {{ currentBooking.note || 'No booking note provided.' }}</p>
            <p class="muted">Messages now sync instantly between the client and executive.</p>
            <a class="ghost-button" routerLink="/dashboard">Back to dashboard</a>
          </aside>
        </div>

        @if (error()) {
          <p class="error-banner">{{ error() }}</p>
        }

        <section class="panel stack-lg chat-panel">
          <div class="section-header chat-section-header">
            <div class="stack-md">
              <p class="eyebrow">Messages</p>
              <h2>Booking chat</h2>
            </div>
            <span class="status-pill" [class.status-muted]="connectionState() !== 'live'">
              {{ connectionLabel() }}
            </span>
          </div>

          <div class="chat-thread">
            <div class="message-list" #messageList [class.message-list-empty]="messages().length === 0">
              @if (messages().length === 0) {
                <div class="chat-empty">
                  <p>No messages yet. Start the conversation below.</p>
                </div>
              }

              @for (message of messages(); track message.id) {
                <article
                  class="chat-bubble-shell"
                  [class.chat-bubble-shell-own]="message.sender.id === currentUserId()"
                >
                  @if (message.sender.id !== currentUserId()) {
                    <span class="chat-bubble-author">{{ message.sender.display_name }}</span>
                  }

                  <div
                    class="chat-bubble"
                    [class.chat-bubble-own]="message.sender.id === currentUserId()"
                  >
                    <p class="chat-bubble-text">{{ message.text }}</p>
                    <div class="chat-bubble-meta">
                      <span>{{ message.created_at | date:'shortTime' }}</span>
                    </div>
                  </div>
                </article>
              }
            </div>

            <form class="chat-composer" (ngSubmit)="sendMessage()">
              <div class="chat-composer-shell">
                <textarea
                  id="message-text"
                  class="chat-composer-input"
                  name="messageText"
                  [(ngModel)]="draftMessage"
                  placeholder="Write your update, question, or delivery note"
                  rows="1"
                  required
                  (keydown)="handleComposerKeydown($event)"
                ></textarea>
                <button
                  class="primary-button chat-send-button"
                  type="submit"
                  [disabled]="connectionState() !== 'live'"
                >
                  {{ sendButtonLabel() }}
                </button>
              </div>
              <p class="chat-composer-note">Press Enter to send. Use Shift + Enter for a new line.</p>
            </form>
          </div>
        </section>
      </section>
    } @else {
      <div class="empty-state">
        <h2>Chat unavailable.</h2>
        <a class="primary-button" routerLink="/dashboard">Back to dashboard</a>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatPageComponent {
  private readonly api = inject(MarketplaceService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly messageListRef = viewChild<ElementRef<HTMLElement>>('messageList');

  readonly booking = signal<Booking | null>(null);
  readonly messages = signal<Message[]>([]);
  readonly error = signal('');
  readonly connectionState = signal<ChatConnectionState>('connecting');
  readonly currentUserId = signal<number | null>(null);

  draftMessage = '';
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTimeout: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private readonly bookingId = Number(this.route.snapshot.paramMap.get('bookingId'));

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.clearReconnectTimer();
      this.clearConnectTimeout();
      this.closeSocket();
    });

    if (!this.bookingId) {
      this.connectionState.set('offline');
      return;
    }

    forkJoin({
      booking: this.api.getBooking(this.bookingId),
      messages: this.api.getMessages(this.bookingId),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ booking, messages }) => {
          this.booking.set(booking);
          this.messages.set(messages);
          this.currentUserId.set(
            booking.user_role === 'client' ? booking.client.id : booking.provider.id,
          );
          this.error.set('');
          queueMicrotask(() => this.scrollMessagesToBottom());
          this.connectSocket();
        },
        error: (error) => {
          this.connectionState.set('offline');
          this.error.set(formatApiError(error));
        },
      });
  }

  connectionLabel(): string {
    switch (this.connectionState()) {
      case 'live':
        return 'Live';
      case 'reconnecting':
        return 'Reconnecting...';
      case 'connecting':
        return 'Connecting...';
      default:
        return 'Offline';
    }
  }

  sendButtonLabel(): string {
    return this.connectionState() === 'live' ? 'Send message' : 'Connecting...';
  }

  sendMessage(): void {
    const text = this.draftMessage.trim();
    if (!text) {
      return;
    }

    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.error.set('Live chat is offline. Trying to reconnect now.');
      this.scheduleReconnect();
      return;
    }

    this.error.set('');
    this.socket.send(JSON.stringify({ text }));
    this.draftMessage = '';
  }

  handleComposerKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    event.preventDefault();
    this.sendMessage();
  }

  private connectSocket(): void {
    if (typeof window === 'undefined' || !this.booking()) {
      return;
    }

    this.clearReconnectTimer();
    this.clearConnectTimeout();
    this.closeSocket();
    this.connectionState.set(this.messages().length ? 'reconnecting' : 'connecting');

    this.socket = new WebSocket(this.api.getBookingChatSocketUrl(this.bookingId));
    this.connectTimeout = window.setTimeout(() => {
      if (!this.socket || this.socket.readyState !== WebSocket.CONNECTING) {
        return;
      }

      this.error.set('Live chat could not reach the server. Retrying...');
      this.socket.close();
    }, 4000);

    this.socket.onopen = () => {
      this.clearConnectTimeout();
      this.connectionState.set('live');
      this.error.set('');
    };

    this.socket.onmessage = (event) => {
      this.handleSocketMessage(event.data);
    };

    this.socket.onclose = (event) => {
      this.clearConnectTimeout();
      this.socket = null;
      if (this.destroyed) {
        return;
      }

      if ([4401, 4403, 4404].includes(event.code)) {
        this.connectionState.set('offline');
        this.error.set('This live chat is unavailable for your current session.');
        return;
      }

      this.scheduleReconnect();
    };

    this.socket.onerror = () => {
      if (!this.destroyed) {
        this.clearConnectTimeout();
        this.error.set('Live chat hit a connection issue. Reconnecting...');
      }
    };
  }

  private handleSocketMessage(rawPayload: string): void {
    try {
      const payload = JSON.parse(rawPayload) as
        | { type: 'chat.message'; message: Message }
        | { type: 'chat.error'; detail: string };

      if (payload.type === 'chat.message') {
        let didAppend = false;
        this.messages.update((messages) =>
          messages.some((message) => message.id === payload.message.id)
            ? messages
            : ((didAppend = true), [...messages, payload.message]),
        );
        if (didAppend) {
          queueMicrotask(() => this.scrollMessagesToBottom());
        }
        return;
      }

      this.error.set(payload.detail);
    } catch {
      this.error.set('Received an unexpected websocket payload.');
    }
  }

  private scheduleReconnect(): void {
    if (this.destroyed || this.reconnectTimer) {
      return;
    }

    this.connectionState.set('reconnecting');
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connectSocket();
    }, 1500);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearConnectTimeout(): void {
    if (this.connectTimeout) {
      window.clearTimeout(this.connectTimeout);
      this.connectTimeout = null;
    }
  }

  private closeSocket(): void {
    if (!this.socket) {
      return;
    }

    this.socket.onopen = null;
    this.socket.onmessage = null;
    this.socket.onclose = null;
    this.socket.onerror = null;

    if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
      this.socket.close();
    }

    this.socket = null;
  }

  private scrollMessagesToBottom(): void {
    const messageList = this.messageListRef()?.nativeElement;
    if (!messageList) {
      return;
    }

    messageList.scrollTop = messageList.scrollHeight;
  }
}
