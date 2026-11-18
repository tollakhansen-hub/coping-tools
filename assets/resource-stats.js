/* Best-effort counts. Actions must remain usable without a network connection. */
window.recordResourceAction = (page, action) => {
  try {
    const body = JSON.stringify({ page, action });
    void fetch('/api/guide-event', {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true
    }).catch(() => {});
  } catch {
    // Statistics are optional.
  }
};
