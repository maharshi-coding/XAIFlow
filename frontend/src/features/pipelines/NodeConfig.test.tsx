import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NodeConfig } from './NodeConfig';
import type { FlowNode } from './graph';
import type { Parameters } from '../../types/domain';

afterEach(cleanup);

function ConfigHarness({ changed }: { changed: (parameters: Parameters) => void }) {
  const [node, setNode] = useState<FlowNode>({
    id: 'network',
    type: 'stage',
    position: { x: 0, y: 0 },
    data: {
      stage: 'pytorch',
      label: 'Network',
      category: 'Models',
      parameters: { hidden_dims: [32, 16], epochs: 30 },
    },
  });
  return (
    <NodeConfig
      node={node}
      datasets={[]}
      update={(label, parameters) => {
        changed(parameters);
        setNode({ ...node, data: { ...node.data, label, parameters } });
      }}
      duplicate={() => {}}
      remove={() => {}}
      close={() => {}}
    />
  );
}

describe('node configuration editing', () => {
  it('connects selected stages without a drag gesture and clears the connection field', () => {
    const connect = vi.fn();
    const node: FlowNode = {
      id: 'forest',
      type: 'stage',
      position: { x: 0, y: 0 },
      data: { stage: 'random_forest', label: 'Forest', category: 'Models', parameters: {} },
    };
    render(
      <NodeConfig
        node={node}
        datasets={[]}
        update={() => {}}
        duplicate={() => {}}
        remove={() => {}}
        close={() => {}}
        connectionOptions={{
          incoming: [{ ...node, id: 'split', data: { ...node.data, label: 'Split' } }],
          outgoing: [{ ...node, id: 'evaluate', data: { ...node.data, label: 'Evaluate' } }],
          connect,
        }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Add incoming connection' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Connect from stage'), { target: { value: 'split' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add incoming connection' }));
    expect(connect).toHaveBeenLastCalledWith('split', 'forest');
    expect(screen.getByLabelText('Connect from stage')).toHaveValue('');
    fireEvent.change(screen.getByLabelText('Connect to stage'), { target: { value: 'evaluate' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add outgoing connection' }));
    expect(connect).toHaveBeenLastCalledWith('forest', 'evaluate');
  });

  it('allows intermediate comma input without silently inserting a zero-width layer', () => {
    const changed = vi.fn();
    render(<ConfigHarness changed={changed} />);
    const input = screen.getByLabelText('Hidden Dims');
    fireEvent.change(input, { target: { value: '64,' } });
    expect(input).toHaveValue('64,');
    expect(changed).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '64, 32' } });
    fireEvent.blur(input);
    expect(changed).toHaveBeenLastCalledWith({ hidden_dims: [64, 32], epochs: 30 });
  });

  it('preserves numeric parameter types when replacing a cleared field', () => {
    const changed = vi.fn();
    render(<ConfigHarness changed={changed} />);
    const input = screen.getByLabelText('Epochs');
    fireEvent.change(input, { target: { value: '' } });
    expect(input).toHaveAttribute('type', 'number');
    fireEvent.change(input, { target: { value: '60' } });
    expect(changed).toHaveBeenLastCalledWith({ hidden_dims: [32, 16], epochs: 60 });
  });
});
