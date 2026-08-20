import { CONFIG } from './config.js';
import { $, el, toast } from './util.js';

// Course membership. The anon key is public by design; RLS is what protects
// rows. A student joins with a code, and everything they save is scoped to the
// course they joined.
let client = null;
export function supa() {
  if (client) return client;
  const { url, anonKey } = CONFIG.supabase;
  if (!url || !anonKey || !window.supabase) return null;
  client = window.supabase.createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
  return client;
}

export async function mountAuth() {
  const host = $('#auth');
  const sb = supa();
  if (!sb) {
    host.replaceChildren(el('p', { class: 'note' },
      'Course sign-in is not configured on this deployment yet. All public layers work without an account.'));
    return;
  }
  const { data: { session } } = await sb.auth.getSession();
  session ? renderMember(host, sb, session) : renderSignIn(host, sb);
  sb.auth.onAuthStateChange((_e, s) => s ? renderMember(host, sb, s) : renderSignIn(host, sb));
}

function renderSignIn(host, sb) {
  const email = el('input', { type: 'email', placeholder: 'you@gc.cuny.edu', autocomplete: 'email' });
  const btn = el('button', { class: 'btn primary', text: 'Email me a sign-in link' });
  btn.addEventListener('click', async () => {
    if (!email.value) return toast('Enter your email first');
    btn.disabled = true;
    const { error } = await sb.auth.signInWithOtp({
      email: email.value,
      options: { emailRedirectTo: location.origin }
    });
    btn.disabled = false;
    toast(error ? error.message : 'Check your email for the link.');
  });
  host.replaceChildren(
    el('p', { class: 'note' },
      'Sign in to join a course, save layers you build, and share them with the class. Browsing the public layers needs no account.'),
    el('div', { class: 'field' }, el('label', { text: 'Email' }), email),
    btn);
}

async function renderMember(host, sb, session) {
  const { data: rows } = await sb.from('memberships')
    .select('role, courses(code, title)').order('created_at');
  const code = el('input', { type: 'text', placeholder: 'Course code', autocomplete: 'off' });
  const join = el('button', { class: 'btn', text: 'Join course' });
  join.addEventListener('click', async () => {
    const { error } = await sb.rpc('join_course', { p_code: code.value.trim().toUpperCase() });
    toast(error ? error.message : 'Joined.');
    if (!error) renderMember(host, sb, session);
  });
  const out = el('button', { class: 'btn', text: 'Sign out' });
  out.addEventListener('click', () => sb.auth.signOut());

  host.replaceChildren(
    el('p', { class: 'note', text: `Signed in as ${session.user.email}` }),
    el('div', { class: 'group' },
      el('h2', {}, el('span', { text: 'Your courses' })),
      (rows?.length
        ? el('div', {}, rows.map(r => el('div', { class: 'layer' },
            el('span', {}, el('span', { class: 'name', text: r.courses?.title || r.courses?.code }),
              el('span', { class: 'meta', text: `${r.courses?.code} · ${r.role}` })))))
        : el('p', { class: 'blurb', text: 'No courses yet.' }))),
    el('div', { class: 'field' }, el('label', { text: 'Join with a code' }), code),
    join, ' ', out);
}
