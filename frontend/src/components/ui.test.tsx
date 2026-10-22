import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Modal } from './ui';
afterEach(cleanup);

function EditableDialog() {
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Edit project</button>
      {open && (
        <Modal title="Project details" onClose={() => setOpen(false)}>
          <input
            aria-label="Project name"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <textarea aria-label="Description" />
          <button>Save</button>
        </Modal>
      )}
    </>
  );
}

describe('editable dialog focus', () => {
  it('keeps the active field focused when a parent rerenders after typing', () => {
    render(<EditableDialog />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit project' }));
    const description = screen.getByRole('textbox', { name: 'Description' });
    description.focus();
    fireEvent.change(screen.getByRole('textbox', { name: 'Project name' }), {
      target: { value: 'Churn' },
    });
    expect(description).toHaveFocus();
  });
  it('closes on Escape, restores trigger focus, and restores page scrolling', () => {
    render(<EditableDialog />);
    const trigger = screen.getByRole('button', { name: 'Edit project' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
  });
});
