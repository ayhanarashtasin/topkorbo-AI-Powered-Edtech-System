const reviewCountFormatter = new Intl.NumberFormat('en-US');
const ratingFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});
const reviewDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric'
});

export function formatReviewDate(value) {
  if (!value) return '';

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : reviewDateFormatter.format(date);
}

export function formatReviewCount(value) {
  return reviewCountFormatter.format(Number(value) || 0);
}

export function formatRating(value) {
  return ratingFormatter.format(Number(value) || 0);
}

export function getConnectionDetails(status) {
  if (status === 'accepted') {
    return {
      tone: 'connected',
      statusLabel: 'Connected',
      actionLabel: 'Connected',
      canRequest: false
    };
  }

  if (status === 'pending') {
    return {
      tone: 'pending',
      statusLabel: 'Request pending',
      actionLabel: 'Request pending',
      canRequest: false
    };
  }

  if (status === 'declined') {
    return {
      tone: 'available',
      statusLabel: 'Open to reconnect',
      actionLabel: 'Request again',
      canRequest: true
    };
  }

  return {
    tone: 'available',
    statusLabel: 'Open to requests',
    actionLabel: 'Send request',
    canRequest: true
  };
}
