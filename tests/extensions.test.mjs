import test from 'node:test';
import assert from 'node:assert/strict';
import {Extensions} from '../src/modules/extensions.mjs';

test('command registration and listeners are isolated and reversible', () => {
    const first = new Extensions();
    const second = new Extensions();
    const command = () => 'first';
    const remove = first.register('example:command', command);
    assert.equal(first.getCommand('example:command')(), 'first');
    assert.equal(second.getCommand('example:command'), undefined);
    assert.throws(() => first.register('example:command', command), /already registered/);
    const events = [];
    const unsubscribe = first.on('change', value => events.push(value));
    first.emit('change', 'a');
    unsubscribe();
    first.emit('change', 'b');
    assert.deepEqual(events, ['a']);
    remove();
    assert.equal(first.getCommand('example:command'), undefined);
});

test('cleanup is LIFO, idempotent and runs all disposers on error', () => {
    const extensions = new Extensions();
    const calls = [];
    extensions.addCleanup(() => calls.push(1));
    extensions.addCleanup(() => { calls.push(2); throw new Error('fixture'); });
    assert.throws(() => extensions.destroy(), AggregateError);
    extensions.destroy();
    assert.deepEqual(calls, [2, 1]);
    assert.throws(() => extensions.register('after:destroy', () => {}), TypeError);
});
