import { useEffect, useState } from 'preact/hooks';

const TOKEN_KEY = 'liberty-lighthouse-comment-token';

interface Props {
  pageType: 'faq' | 'video' | 'glossary';
  pageId: string;
}

type SubmitStatus = 'idle' | 'success' | 'error';

export default function CommentForm({ pageType, pageId }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.sessionStorage.getItem(TOKEN_KEY);
    if (stored) setToken(stored);
  }, []);

  function startOAuth() {
    const popup = window.open(
      '/api/comment-auth',
      'github-comment-auth',
      'width=600,height=720',
    );
    if (!popup) {
      setStatus('error');
      setErrorMsg(
        'Could not open the GitHub sign-in popup. Please allow popups for this site, or open /api/comment-auth in a new tab and copy the token manually.',
      );
      return;
    }
    function onMessage(e: MessageEvent) {
      if (typeof e.data !== 'string') return;
      // Handshake: when the callback popup posts "authorizing:github" to
      // announce itself, we have to post anything back. The callback at
      // api/callback.js uses e.origin from our response to know where to
      // target the eventual access-token postMessage. Without this the
      // popup hangs blank (which is exactly what happened in production).
      if (e.data === 'authorizing:github') {
        if (e.source && typeof (e.source as Window).postMessage === 'function') {
          (e.source as Window).postMessage('github:auth-handshake', e.origin || '*');
        }
        return;
      }
      const m = /^authorization:github:success:(.+)$/.exec(e.data);
      if (!m) return;
      try {
        const payload = JSON.parse(m[1]);
        if (payload && typeof payload.token === 'string' && payload.token.length > 0) {
          window.sessionStorage.setItem(TOKEN_KEY, payload.token);
          setToken(payload.token);
          setStatus('idle');
          setErrorMsg('');
        }
      } catch {
        /* ignore parse errors */
      } finally {
        window.removeEventListener('message', onMessage);
        try {
          popup?.close();
        } catch {
          /* ignore */
        }
      }
    }
    window.addEventListener('message', onMessage);
  }

  function signOut() {
    window.sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setStatus('idle');
  }

  async function submit(e: Event) {
    e.preventDefault();
    if (!token) return;
    const trimmedBody = body.trim();
    if (trimmedBody.length < 2) return;
    setSubmitting(true);
    setStatus('idle');
    setErrorMsg('');
    try {
      const resp = await fetch('/api/comments/submit', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          page_type: pageType,
          page_id: pageId,
          name: name.trim() || undefined,
          body: trimmedBody,
        }),
      });
      const data: {
        error?: string;
        ok?: boolean;
        github_status?: number;
        detail?: string;
      } = await resp.json().catch(() => ({}));
      if (resp.ok && data.ok) {
        setStatus('success');
        setBody('');
      } else {
        setStatus('error');
        const parts = [data.error || `Submission failed (HTTP ${resp.status})`];
        if (data.github_status) parts.push(`GitHub returned ${data.github_status}`);
        if (data.detail) parts.push(data.detail.slice(0, 200));
        setErrorMsg(parts.join(' — '));
        if (resp.status === 401) {
          window.sessionStorage.removeItem(TOKEN_KEY);
          setToken(null);
        }
      }
    } catch (err) {
      setStatus('error');
      setErrorMsg((err as Error).message || 'Network error');
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div class="comment-form-shell">
        <p class="comment-form-intro">
          Sign in with your GitHub account to leave a comment. Comments are reviewed by the
          Centre for Civil Society team before they appear publicly.
        </p>
        <button type="button" class="comment-signin" onClick={startOAuth}>
          Sign in with GitHub to comment
        </button>
        {status === 'error' && <p class="comment-error">{errorMsg}</p>}
      </div>
    );
  }

  return (
    <form class="comment-form-shell" onSubmit={submit}>
      <label class="comment-field">
        <span class="comment-field-label">Display name (optional)</span>
        <input
          type="text"
          value={name}
          onInput={(e) => setName((e.target as HTMLInputElement).value)}
          maxLength={120}
          placeholder="Defaults to your GitHub display name"
        />
      </label>
      <label class="comment-field">
        <span class="comment-field-label">Your comment</span>
        <textarea
          value={body}
          onInput={(e) => setBody((e.target as HTMLTextAreaElement).value)}
          required
          minLength={2}
          maxLength={5000}
          rows={5}
          placeholder="Be respectful and on-topic. Comments are pre-moderated."
        />
      </label>
      <p class="comment-hint">
        Your comment will be filed under your GitHub identity and reviewed before publishing
        (typically within a day). It will be hidden from the site until approved.
      </p>
      <div class="comment-actions">
        <button type="submit" disabled={submitting || body.trim().length < 2}>
          {submitting ? 'Submitting…' : 'Submit for review'}
        </button>
        <button type="button" class="comment-signout" onClick={signOut}>
          Sign out
        </button>
      </div>
      {status === 'success' && (
        <p class="comment-success" role="status">
          Thanks — your comment is awaiting review.
        </p>
      )}
      {status === 'error' && (
        <p class="comment-error" role="alert">
          Could not submit: {errorMsg}
        </p>
      )}
    </form>
  );
}
