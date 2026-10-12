// Behaviour tests for the React port. They run against a tiny in-memory fake of the Express API
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';

const EFFECTS = [
  {
    id: 2, name: 'Burn', icon: '/media/status_icons/burn.png', max_potency: 99, max_stack: 99,
    description: "At the end of the turn, take fixed damage by the effect's Potency.",
    related_effects: [{ id: 3, name: 'Dark Flame', icon: '/media/status_icons/df.png' }],
  },
  {
    id: 3, name: 'Dark Flame', icon: '/media/status_icons/df.png', max_potency: 1, max_stack: 7,
    description: 'Unique Burn. Target loses Defence Level.',
    related_effects: [{ id: 2, name: 'Burn', icon: '/media/status_icons/burn.png' }],
  },
  {
    id: 1, name: 'Poison', icon: '/media/status_icons/poison.png', max_potency: 1, max_stack: 99,
    description: 'Take fixed damage by the Count, then halve the Count.',
    related_effects: [],
  },
];

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => (body ? JSON.stringify(body) : ''),
});

//Fake Express API
function installFakeApi({ effects = EFFECTS, onCreate } = {}) {
  let data = structuredClone(effects);
  const calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, options = {}) => {
      const method = options.method ?? 'GET';
      calls.push({ url, method, body: options.body });
      if (url === '/api/effects' && method === 'GET') return reply(200, { effects: data });
      if (url === '/api/effects' && method === 'POST') {
        return onCreate ? onCreate(options.body) : reply(201, { effect: data[0] });
      }
      const del = url.match(/^\/api\/effects\/(\d+)$/);
      if (del && method === 'DELETE') {
        data = data.filter((e) => e.id !== Number(del[1]));
        return reply(204, null);
      }
      return reply(404, { error: 'Not found' });
    }),
  );
  return calls;
}

const cardNames = () => [...document.querySelectorAll('.effect-card h3')].map((h) => h.textContent);
const search = (value) => fireEvent.change(screen.getByPlaceholderText(/search by name/i), { target: { value } });
const settle = () => act(() => vi.advanceTimersByTime(250)); // let the 200 ms debounce fire
const submitModalForm = () => fireEvent.submit(screen.getByRole('dialog').querySelector('form'));

beforeEach(() => {
  localStorage.clear();
  document.body.className = '';
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('listing', () => {
  it('renders every effect with its stats and related icons', async () => {
    installFakeApi();
    render(<App />);
    await screen.findByText('Poison');

    expect(cardNames()).toEqual(['Burn', 'Dark Flame', 'Poison']);
    expect(screen.getByText(/Max Potency: 99/)).toHaveTextContent('Max Count: 99');
    const burn = screen.getByText('Burn', { selector: 'h3' }).closest('.effect-card');
    expect(within(burn).getByTitle('Dark Flame')).toHaveAttribute('src', '/media/status_icons/df.png');
    expect(screen.getByText('Poison', { selector: 'h3' }).closest('.effect-card').querySelector('.related')).toBeNull();
    expect(screen.getByText('Type at least 3 characters to filter')).toBeInTheDocument();
  });

  it('shows a message when the API is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network')));
    render(<App />);
    expect(await screen.findByText(/could not reach the server/i)).toBeInTheDocument();
  });
});

describe('search box (the original page script)', () => {
  it('does not filter until 3 characters, and counts down the characters needed', async () => {
    installFakeApi();
    render(<App />);
    await screen.findByText('Poison');

    search('b');
    expect(screen.getByText('2 more character(s) to start filtering...')).toBeInTheDocument();
    search('bu');
    expect(screen.getByText('1 more character(s) to start filtering...')).toBeInTheDocument();
    expect(cardNames()).toHaveLength(3);
  });

  it('filters name OR description, case-insensitively, after a 200 ms debounce', async () => {
    installFakeApi();
    render(<App />);
    await screen.findByText('Poison');
    vi.useFakeTimers();

    search('BURN'); // matches Burn (name) and Dark Flame (description: "Unique Burn")
    expect(screen.getByText('Filtering...')).toBeInTheDocument();
    expect(cardNames()).toHaveLength(3);
    act(() => vi.advanceTimersByTime(199));
    expect(cardNames()).toHaveLength(3);
    act(() => vi.advanceTimersByTime(1));
    expect(cardNames()).toEqual(['Burn', 'Dark Flame']);
    expect(screen.getByText('Showing results for "BURN"')).toBeInTheDocument();
  });

  it('restarts the debounce while the user keeps typing', async () => {
    installFakeApi();
    render(<App />);
    await screen.findByText('Poison');
    vi.useFakeTimers();

    search('poi');
    act(() => vi.advanceTimersByTime(150));
    search('pois');
    act(() => vi.advanceTimersByTime(150));
    expect(cardNames()).toHaveLength(3);
    act(() => vi.advanceTimersByTime(60));
    expect(cardNames()).toEqual(['Poison']);
  });

  it('shows "No status effects found." and resets when the box is cleared', async () => {
    installFakeApi();
    render(<App />);
    await screen.findByText('Poison');
    vi.useFakeTimers();

    search('zzzz');
    settle();
    expect(cardNames()).toEqual([]);
    expect(screen.getByText('No status effects found.')).toBeInTheDocument();

    search('');
    expect(cardNames()).toHaveLength(3);
    expect(screen.queryByText('No status effects found.')).toBeNull();
    expect(screen.getByText('Type at least 3 characters to filter')).toBeInTheDocument();
  });

  it('does not bring back a stale filter while the next search is debouncing', async () => {
    installFakeApi();
    render(<App />);
    await screen.findByText('Poison');
    vi.useFakeTimers();

    search('burn');
    settle();
    expect(cardNames()).toEqual(['Burn', 'Dark Flame']);
    search('');
    search('poi');
    expect(cardNames()).toHaveLength(3);
    settle();
    expect(cardNames()).toEqual(['Poison']);
  });
});

describe('add modal', () => {
  it('opens from the button and closes via ✕, Cancel, Escape and the backdrop', async () => {
    installFakeApi();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Poison');
    expect(screen.queryByRole('dialog')).toBeNull();

    for (const close of [
      () => user.click(screen.getByLabelText('Close')),
      () => user.click(screen.getByText('Cancel')),
      () => user.keyboard('{Escape}'),
      () => user.click(document.getElementById('modal-overlay')),
    ]) {
      await user.click(screen.getByText('+ Add Effect'));
      expect(screen.getByRole('dialog', { name: 'Add Status Effect' })).toBeInTheDocument();
      expect(document.body.style.overflow).toBe('hidden');
      await close();
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(document.body.style.overflow).toBe('');
    }
  });

  it('clicking inside the dialog does not close it', async () => {
    installFakeApi();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Poison');
    await user.click(screen.getByText('+ Add Effect'));
    await user.click(screen.getByRole('heading', { name: 'Add Status Effect' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('lists existing effects as related-effect checkboxes', async () => {
    installFakeApi();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Poison');
    await user.click(screen.getByText('+ Add Effect'));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getAllByRole('checkbox').map((c) => c.parentElement.textContent.trim())).toEqual([
      'Burn', 'Dark Flame', 'Poison',
    ]);
  });

  it('says so when there are no other effects yet', async () => {
    installFakeApi({ effects: [] });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('No status effects found.');
    await user.click(screen.getByText('+ Add Effect'));
    expect(screen.getByText('No other effects yet')).toBeInTheDocument();
  });

  it('submits multipart form data, then closes and reloads the list', async () => {
    const calls = installFakeApi();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Poison');

    await user.click(screen.getByText('+ Add Effect'));
    await user.type(screen.getByLabelText('Name'), 'Rupture');
    await user.upload(screen.getByLabelText(/Icon/), new File(['png-bytes'], 'rupture.png', { type: 'image/png' }));
    await user.type(screen.getByLabelText('Description'), 'Take damage when hit.');
    await user.clear(screen.getByLabelText('Max Potency'));
    await user.type(screen.getByLabelText('Max Potency'), '99');
    await user.click(screen.getByLabelText('Burn'));
    await user.click(screen.getByLabelText('Poison'));
    submitModalForm();

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const post = calls.find((c) => c.method === 'POST');
    expect(post.url).toBe('/api/effects');
    expect(post.body).toBeInstanceOf(FormData);
    expect(post.body.get('name')).toBe('Rupture');
    expect(post.body.get('description')).toBe('Take damage when hit.');
    expect(post.body.get('max_potency')).toBe('99');
    expect(post.body.get('max_stack')).toBe('1');
    expect(post.body.get('icon').name).toBe('rupture.png');
    expect(post.body.getAll('related_effects')).toEqual(['2', '1']);
    expect(calls.filter((c) => c.method === 'GET')).toHaveLength(2);
  });

  it('keeps the modal open and shows server-side errors under each field', async () => {
    installFakeApi({
      onCreate: () =>
        reply(400, {
          errors: {
            icon: ['Unsupported extension: .gif. Use .jpg or .png'],
            max_potency: ['Ensure this value is greater than or equal to 0.'],
          },
        }),
    });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Poison');

    await user.click(screen.getByText('+ Add Effect'));
    await user.type(screen.getByLabelText('Name'), 'Whatever');
    await user.upload(screen.getByLabelText(/Icon/), new File(['x'], 'a.png', { type: 'image/png' }));
    await user.type(screen.getByLabelText('Description'), 'desc');
    submitModalForm();

    const iconGroup = (await screen.findByText(/Unsupported extension/)).closest('.form-group');
    expect(within(iconGroup).getByText(/Icon/)).toBeInTheDocument();
    expect(screen.getByText(/greater than or equal to 0/).closest('.form-group')).toHaveTextContent('Max Potency');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Whatever');
    expect(screen.getByText('Save Effect')).toBeEnabled();
  });
});

describe('deleting (Shift + hover)', () => {
  it('marks cards shift-held only while Shift is down', async () => {
    installFakeApi();
    render(<App />);
    await screen.findByText('Poison');
    const cards = () => document.querySelectorAll('.effect-card');

    expect([...cards()].some((c) => c.classList.contains('shift-held'))).toBe(false);
    fireEvent.keyDown(document, { key: 'Shift' });
    expect([...cards()].every((c) => c.classList.contains('shift-held'))).toBe(true);
    fireEvent.keyUp(document, { key: 'Shift' });
    expect([...cards()].some((c) => c.classList.contains('shift-held'))).toBe(false);

    fireEvent.keyDown(document, { key: 'Shift' });
    fireEvent.blur(window); // window lost focus while Shift was held
    expect([...cards()].some((c) => c.classList.contains('shift-held'))).toBe(false);
  });

  it('asks for confirmation, then deletes and reloads', async () => {
    const calls = installFakeApi();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Poison');

    await user.click(screen.getByTitle('Delete Poison'));
    expect(confirm).toHaveBeenCalledWith('Delete Poison?');
    await waitFor(() => expect(cardNames()).toEqual(['Burn', 'Dark Flame']));
    expect(calls.some((c) => c.method === 'DELETE' && c.url === '/api/effects/1')).toBe(true);
  });

  it('does nothing if the confirmation is cancelled', async () => {
    const calls = installFakeApi();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Poison');

    await user.click(screen.getByTitle('Delete Poison'));
    expect(cardNames()).toHaveLength(3);
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
  });
});

describe('dark mode', () => {
  it('toggles body.dark and remembers the choice', async () => {
    installFakeApi();
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await screen.findByText('Poison');
    expect(document.body).not.toHaveClass('dark');

    await user.click(screen.getByTitle('Toggle dark mode'));
    expect(document.body).toHaveClass('dark');
    expect(localStorage.getItem('theme')).toBe('dark');

    unmount();
    document.body.className = '';
    render(<App />);
    await screen.findByText('Poison');
    expect(document.body).toHaveClass('dark');
    expect(document.getElementById('theme-checkbox')).toBeChecked();

    await user.click(screen.getByTitle('Toggle dark mode'));
    expect(document.body).not.toHaveClass('dark');
    expect(localStorage.getItem('theme')).toBe('light');
  });
});
