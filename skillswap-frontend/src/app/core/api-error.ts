import { HttpErrorResponse } from '@angular/common/http';

function flattenErrorValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => flattenErrorValue(entry));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) =>
      flattenErrorValue(nested).map((message) =>
        key === 'detail' || key === 'non_field_errors'
          ? message
          : `${key.replace(/_/g, ' ')}: ${message}`,
      ),
    );
  }

  if (value === null || value === undefined) {
    return [];
  }

  return [String(value)];
}

export function formatApiError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const messages = flattenErrorValue(error.error);
    if (messages.length > 0) {
      return messages.join(' ');
    }

    if (error.status) {
      return `Request failed with status ${error.status}.`;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Something went wrong.';
}
